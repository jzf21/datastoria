import type { GraphEdge } from "@/components/graphviz-component/Graph";
import { uuid2 } from "@/lib/uuid-utils";
import { MD5 } from "crypto-js";

// The response data object
interface Table {
  id: string;
  uuid: string;
  database: string;
  name: string;
  engine: string;
  tableQuery: string;

  dependenciesDatabase: string[];
  dependenciesTable: string[];

  // Runtime Argument
  isInnerTable: boolean;
}

export interface DependencyGraphNode {
  id: string;

  type: "Internal" | "External";

  database: string;
  name: string;
  engine: string;
  query: string;

  // ids of target nodes
  targets: string[];
}

type EngineProcessor = (source: Table) => void;

export class DependencyBuilder {
  private MV_SINK_TO_EXPR = /^CREATE MATERIALIZED VIEW [a-zA-Z_0-9\\.]* (TO ([a-zA-Z_0-9\\.]*))?/;
  private DISTRIBUTED_REGEXPR = / +Distributed\('[a-zA-Z0-9_]+', '([a-zA-Z0-9_]+)', '([a-zA-Z0-9_]+)'/;
  private MYSQL_ENGINE_REGEXPR = / +MySQL\('([^']+)', *'([^']+)', *'([^']+)'/;
  private BUFFER_ENGINE_REGEXPR = / +Buffer\('([^']+)', *'([^']+)'/;
  private KAFKA_BROKER_REGEXPR = /kafka_broker_list *= *'([^']+)'/;
  private KAFKA_TOPIC_REGEXPR = /kafka_topic_list *= *'([^']+)'/;
  private URL_ENGINE_REGEXPR = / +URL\('([^']+)'/;

  private tables: Table[] = [];
  private nodes = new Map<string, DependencyGraphNode>();
  private edges: GraphEdge[] = [];

  /**
   * uuid to table mapping
   */
  private idMaps = new Map<string, Table>();

  /**
   * fqdn name to table mapping
   */
  private tableMap: Map<string, Table> = new Map<string, Table>();
  private engineProcessors: Map<string, EngineProcessor> = new Map<string, EngineProcessor>();

  constructor(tables: Table[]) {
    this.tables = tables;

    //
    // Register engine processor
    //
    this.engineProcessors.set("MySQL", (source: Table) => {
      const matches = source.tableQuery.match(this.MYSQL_ENGINE_REGEXPR);
      if (matches !== null) {
        this.addExternalDependency(source, "MySQL Server", matches[1], "[Table]" + matches[2] + "." + matches[3]);
      }
    });

    this.engineProcessors.set("Kafka", (source: Table) => {
      const brokerMatch = source.tableQuery.match(this.KAFKA_BROKER_REGEXPR);
      const topicMatch = source.tableQuery.match(this.KAFKA_TOPIC_REGEXPR);
      if (brokerMatch !== null && topicMatch !== null) {
        let broker;
        const brokers = brokerMatch[1];
        if (brokers !== undefined) {
          // Use the first broker in the list
          broker = brokers.split(",")[0];
          this.addExternalDependency(source, "Kafka Server", broker, "[Topic]" + topicMatch[1]);
        }
      }
    });

    this.engineProcessors.set("URL", (source: Table) => {
      const matches = source.tableQuery.match(this.URL_ENGINE_REGEXPR);
      if (matches !== null && matches[1] !== undefined) {
        const url = matches[1];
        this.addExternalDependency(source, "URL", url);
      }
    });

    this.engineProcessors.set("Dictionary", (source: Table) => {
      const index = source.tableQuery.indexOf("SOURCE(CLICKHOUSE(");
      if (index > -1) {
        const configuration = source.tableQuery.substring(index);
        const database = configuration.match(/DB *'([^']*)'/);
        const table = configuration.match(/TABLE *'([^']*)'/);
        if (database !== null && table !== null) {
          this.addTableDependency(source, database[1], table[1], "Load From");
        }
      }
    });

    // Internal dependencies
    this.engineProcessors.set("MaterializedView", (source: Table) => {
      const matches = source.tableQuery.match(this.MV_SINK_TO_EXPR);
      if (matches !== null) {
        const sinkToFullName = matches[2];
        if (sinkToFullName !== undefined) {
          const dot = sinkToFullName.indexOf(".");
          if (dot > -1) {
            const sinkToNames = sinkToFullName.split(".");
            this.addTableDependency(source, sinkToNames[0], sinkToNames[1], "Sink To");
          } else {
            this.addTableDependency(source, source.database, sinkToFullName, "Sink To");
          }
        }
      }
    });

    this.engineProcessors.set("Distributed", (source: Table) => {
      const matches = source.tableQuery.match(this.DISTRIBUTED_REGEXPR);
      if (matches !== null && matches[1] !== undefined && matches[2] !== undefined) {
        this.addTableDependency(
          source,
          // target database
          matches[1],
          // target table
          matches[2]
        );
      }
    });

    this.engineProcessors.set("Buffer", (source: Table) => {
      const matches = source.tableQuery.match(this.BUFFER_ENGINE_REGEXPR);
      if (matches !== null && matches[1] !== undefined && matches[2] !== undefined) {
        this.addTableDependency(
          source,
          // target database
          matches[1],
          // target table
          matches[2]
        );
      }
    });
  }

  private processTableDependencies(source: Table, database: string): void {
    // Handle dependencies_database and dependencies_table arrays
    if (Array.isArray(source.dependenciesDatabase) && Array.isArray(source.dependenciesTable)) {
      for (let i = 0; i < source.dependenciesDatabase.length; i++) {
        const targetDatabase = source.dependenciesDatabase[i];
        const targetTable = source.dependenciesTable[i];
        if (targetDatabase && targetTable && targetDatabase === database) {
          this.addTableDependency(source, targetDatabase, targetTable);
        }
      }
    } else if (source.dependenciesDatabase && source.dependenciesTable) {
      // Handle single string values (legacy support)
      const depDb = typeof source.dependenciesDatabase === "string" ? source.dependenciesDatabase : "";
      const depTable = typeof source.dependenciesTable === "string" ? source.dependenciesTable : "";
      if (depDb && depTable) {
        this.addTableDependency(source, depDb, depTable);
      }
    }

    // Process engine-specific dependencies using registry pattern
    const processor = this.engineProcessors.get(source.engine);
    if (processor) {
      processor(source);
    }
  }

  // Build dependency graph
  public build(database: string) {
    // Round 1, split inner tables and external tables
    this.tables.forEach((table) => {
      table.isInnerTable = table.name.startsWith(".inner_id.");

      this.idMaps.set(table.uuid, table);
      this.tableMap.set(table.id, table);
    });

    // Round 2, build the dependency for external tables first
    this.tables.forEach((source) => {
      this.processTableDependencies(source, database);
    });

    // // Round 3, Processing inner tables, convert the inner table to its original table
    // for (const innerTable of innerTables) {
    //   const innerTableId = innerTable.name.substring(".inner_id.".length);
    //   const originalTable = idMaps.get(innerTableId);
    //   if (originalTable) {
    //     innerTable.name = originalTable.name;
    //     innerTable.id = originalTable.database + "." + originalTable.name;
    //     this.processTableDependencies(innerTable, originalTable.database);
    //   }
    // }
  }

  private addTableDependency(
    source: Table,
    targetTableDb: string,
    targetTableName: string,
    edgeLabel: string | null = null
  ) {
    source = this.getOriginalTable(source);

    let sourceNode = this.nodes.get(source.id);
    if (sourceNode === undefined) {
      sourceNode = {
        id: source.id,
        type: "Internal",
        database: source.database,
        name: source.name,
        engine: source.engine,
        query: source.tableQuery /*format(table.query)*/,
        targets: [],
      };
      this.nodes.set(source.id, sourceNode);
    }

    const targetTableId = targetTableDb + "." + targetTableName;
    const targetTable = this.tableMap.get(targetTableId);

    let targetNode = this.nodes.get(targetTableId);
    if (targetNode === undefined) {
      targetNode = {
        id: targetTableId,
        type: "Internal",
        database: targetTableDb,
        name: targetTableName,
        engine: targetTable === undefined ? "" : targetTable.engine,
        query: targetTable === undefined ? "NOT FOUND" : targetTable.tableQuery,
        targets: [],
      };
      this.nodes.set(targetTableId, targetNode);
    }

    if (targetTable?.engine === "MaterializedView") {
      edgeLabel = "Push To";
    }

    this.edges.push({
      id: "e" + uuid2(),
      source: sourceNode.id,
      target: targetNode.id,
      label:
        edgeLabel === null
          ? this.getDependencyDescription(sourceNode.engine, sourceNode.query, targetNode.database, targetNode.name)
          : edgeLabel,
    });
    sourceNode.targets.push(targetNode.id);
  }

  private addExternalDependency(source: Table, type: string, nodeLabel: string, edgeLabel: string = "") {
    source = this.getOriginalTable(source);

    let sourceNode = this.nodes.get(source.id);
    if (sourceNode === undefined) {
      sourceNode = {
        id: source.id,
        type: "Internal",
        database: source.database,
        name: source.name,
        engine: source.engine,
        query: source.tableQuery /*format(table.query)*/,
        targets: [],
      };
      this.nodes.set(source.id, sourceNode);
    }

    const targetId = "a" + MD5(nodeLabel + "@" + type).toString();

    let targetNode = this.nodes.get(targetId);
    if (targetNode === undefined) {
      targetNode = {
        id: targetId,
        type: "External",
        database: nodeLabel,
        name: "",
        engine: type,
        query: "",
        targets: [],
      };
      this.nodes.set(targetId, targetNode);
    }

    this.edges.push({
      id: "e" + uuid2(),
      source: sourceNode.id,
      target: targetNode.id,
      label: source.engine === "MaterializedView" ? "Sink To" : edgeLabel,
    });
    sourceNode.targets.push(targetNode.id);
  }

  private getDependencyDescription(
    sourceTableEngine: string,
    sourceTableQuery: string,
    targetNodeDatabase: string,
    targetNodeName: string
  ) {
    if (sourceTableEngine === "MaterializedView") {
      const matches = sourceTableQuery.match(this.MV_SINK_TO_EXPR);
      if (matches !== null) {
        const mvSinkTo = matches[2];
        if (targetNodeName === mvSinkTo || targetNodeDatabase + "." + targetNodeName === mvSinkTo) {
          return "Sink To";
        } else {
          return "Select From";
        }
      }
    } else if (sourceTableEngine === "View") {
      return "Select From";
    }
    return undefined;
  }

  private getOriginalTable(table: Table) {
    if (table.isInnerTable) {
      const originalTableId = table.name.substring(".inner_id.".length);
      return this.idMaps.get(originalTableId)!;
    } else {
      return table;
    }
  }

  public getEdges() {
    return this.edges;
  }

  public getNodes() {
    return this.nodes;
  }
}
