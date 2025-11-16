import { describe, it, expect } from 'vitest';
import { searchTree } from './tree-search';
import type { TreeDataItem } from '@/components/ui/tree';

// Helper to create a test tree structure similar to schema tree
function createTestTree(): TreeDataItem[] {
  const hostNode: TreeDataItem = {
    id: 'host',
    text: 'Host1',
    search: 'host1',
    type: 'folder',
    children: [
      {
        id: 'db:system',
        text: 'system',
        search: 'system',
        type: 'folder',
        children: [
          {
            id: 'table:system.query_log',
            text: 'query_log',
            search: 'query_log',
            type: 'folder',
            children: [
              {
                id: 'table:system.query_log.col1',
                text: 'col1',
                search: 'col1',
                type: 'leaf',
              },
            ],
          },
          {
            id: 'table:system.metric_log',
            text: 'metric_log',
            search: 'metric_log',
            type: 'folder',
            children: [
              {
                id: 'table:system.metric_log.timestamp',
                text: 'timestamp',
                search: 'timestamp',
                type: 'leaf',
              },
              {
                id: 'table:system.metric_log.value',
                text: 'value',
                search: 'value',
                type: 'leaf',
              },
            ],
          },
          {
            id: 'table:system.metrics',
            text: 'metrics',
            search: 'metrics',
            type: 'folder',
            children: [],
          },
          {
            id: 'table:system.tables',
            text: 'tables',
            search: 'tables',
            type: 'folder',
            children: [],
          },
        ],
      },
      {
        id: 'db:default',
        text: 'default',
        search: 'default',
        type: 'folder',
        children: [
          {
            id: 'table:default.users',
            text: 'users',
            search: 'users',
            type: 'folder',
            children: [],
          },
        ],
      },
    ],
  };

  return [hostNode];
}

describe('tree-search', () => {
  describe('trailing dot search', () => {
    it('should show system node with all children when searching "system."', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.');

      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.text).toBe('system');

      // System node should be highlighted
      const systemDisplayText = systemNode?.displayText;
      expect(systemDisplayText).toBeDefined();
      const systemIsHighlighted = typeof systemDisplayText === 'object' && systemDisplayText !== null;
      expect(systemIsHighlighted).toBe(true);

      // System node should be expanded
      expect(systemNode?._expanded).toBe(true);

      // Should include all children of system
      expect(systemNode?.children?.length).toBe(4);
      expect(systemNode?.children?.map((c) => c.text)).toEqual(
        expect.arrayContaining(['query_log', 'metric_log', 'metrics', 'tables'])
      );

      // Children should NOT be highlighted (displayText should be plain string, not React element)
      for (const child of systemNode?.children || []) {
        const childDisplayText = child.displayText;
        const childIsHighlighted = typeof childDisplayText === 'object' && childDisplayText !== null;
        expect(childIsHighlighted).toBe(false);
        // Children should have their original text as displayText
        expect(childDisplayText).toBe(child.text);
      }

      // Children should NOT be expanded
      for (const child of systemNode?.children || []) {
        expect(child._expanded).toBe(false);
      }
    });

    it('should highlight both system and query_log when searching "system.query_log."', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.query_log.');

      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.text).toBe('system');
      
      // System node should be highlighted (displayText should be a React element, not plain string)
      const systemDisplayText = systemNode?.displayText;
      expect(systemDisplayText).toBeDefined();
      // If it's highlighted, displayText will be an object (React element), not a plain string
      const systemIsHighlighted = typeof systemDisplayText === 'object' && systemDisplayText !== null;
      expect(systemIsHighlighted).toBe(true);
      
      // CRITICAL: When searching "system.query_log.", system should only have query_log as a child
      // (not all children like metric_log, metrics, tables)
      expect(systemNode?.children?.length).toBe(1);
      expect(systemNode?.children?.[0]?.text).toBe('query_log');
      
      // Should find the query_log table node
      const queryLogNode = systemNode?.children?.find((node) => node.text === 'query_log');
      expect(queryLogNode).toBeDefined();
      expect(queryLogNode?.text).toBe('query_log');
      
      // Query_log node should be highlighted
      const queryLogDisplayText = queryLogNode?.displayText;
      expect(queryLogDisplayText).toBeDefined();
      const queryLogIsHighlighted = typeof queryLogDisplayText === 'object' && queryLogDisplayText !== null;
      expect(queryLogIsHighlighted).toBe(true);
      
      // Query_log should be expanded (show children)
      expect(queryLogNode?._expanded).toBe(true);
      expect(queryLogNode?.children?.length).toBe(1);
      expect(queryLogNode?.children?.[0]?.text).toBe('col1');
    });

    it('should expand query_log when searching "system.query_log." even if system is not expanded', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.query_log.');

      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      
      // Should find the query_log table node
      const queryLogNode = systemNode?.children?.find((node) => node.text === 'query_log');
      expect(queryLogNode).toBeDefined();
      
      // Query_log should be expanded to show its children
      expect(queryLogNode?._expanded).toBe(true);
      expect(queryLogNode?.children?.length).toBe(1);
      expect(queryLogNode?.children?.[0]?.text).toBe('col1');
    });

    it('should show system node with all children when searching "system." with startLevel=1', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.', { startLevel: 1 });

      // Should find the host node (included because it has matching children)
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.text).toBe('Host1');

      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.text).toBe('system');

      // Should include all children of system
      expect(systemNode?.children?.length).toBe(4);
      expect(systemNode?.children?.map((c) => c.text)).toEqual(
        expect.arrayContaining(['query_log', 'metric_log', 'metrics', 'tables'])
      );
    });

    it('should show nothing when searching "nonexistent."', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'nonexistent.');
      expect(result.length).toBe(0);
    });
  });

  describe('multi-segment search', () => {
    it('should show system node with children matching "m" when searching "system.m"', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.m');

      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.text).toBe('system');

      // Should show children that match "m" as substring
      expect(systemNode?.children?.length).toBeGreaterThan(0);
      const childrenNames = systemNode?.children?.map((c) => c.text) || [];
      
      // metric_log and metrics should match (both contain "m")
      expect(childrenNames).toContain('metric_log');
      expect(childrenNames).toContain('metrics');
      
      // tables should NOT match (doesn't contain "m")
      expect(childrenNames).not.toContain('tables');
    });

    it('should show system node with metric_log when searching "system.metric"', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.metric');

      // Should have the host node in result (because it has matching children)
      expect(result.length).toBeGreaterThan(0);
      const hostNode = result[0];
      expect(hostNode?.text).toBe('Host1');
      
      // Should find the system database node
      const systemNode = hostNode?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();

      // Should show metric_log (contains "metric") and metrics (contains "metric")
      const childrenNames = systemNode?.children?.map((c) => c.text) || [];
      expect(childrenNames.length).toBeGreaterThan(0);
      expect(childrenNames).toContain('metric_log');
      expect(childrenNames).toContain('metrics');
    });

    it('should show metric_log table with matching columns when searching "system.metric_log.t"', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.metric_log.t');

      // Navigate to system -> metric_log
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();

      const metricLogNode = systemNode?.children?.find((node) => node.text === 'metric_log');
      expect(metricLogNode).toBeDefined();

      // Should show columns that match "t" as substring
      const childrenNames = metricLogNode?.children?.map((c) => c.text) || [];
      expect(childrenNames).toContain('timestamp'); // contains "t"
      expect(childrenNames).not.toContain('value'); // doesn't contain "t"
    });

    it('should show system node with query_log when searching "system.q"', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.q');

      // Should have the host node in result (because it has matching children)
      expect(result.length).toBeGreaterThan(0);
      const hostNode = result[0];
      expect(hostNode?.text).toBe('Host1');
      
      // Should find the system database node
      const systemNode = hostNode?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();

      // Should show query_log (contains "q" as substring)
      const childrenNames = systemNode?.children?.map((c) => c.text) || [];
      expect(childrenNames.length).toBeGreaterThan(0);
      expect(childrenNames).toContain('query_log');
      
      // Should NOT show other children that don't match "q"
      expect(childrenNames).not.toContain('metric_log');
      expect(childrenNames).not.toContain('metrics');
      expect(childrenNames).not.toContain('tables');
    });
  });

  describe('single segment search', () => {
    it('should show nodes matching "system" when searching "system"', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system');

      // Should find nodes containing "system"
      expect(result.length).toBeGreaterThan(0);
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
    });

    it('should show nodes matching "system" when searching "system" with startLevel=1', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system', { startLevel: 1 });

      // Should find nodes containing "system"
      expect(result.length).toBeGreaterThan(0);
      const hostNode = result[0];
      expect(hostNode?.text).toBe('Host1');
      
      const systemNode = hostNode?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.text).toBe('system');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty search', () => {
      const tree = createTestTree();
      const result = searchTree(tree, '');
      // Empty search should return original tree
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive matching', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'SYSTEM.');
      
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.children?.length).toBe(4);
    });
  });

  describe('startLevel option', () => {
    it('should skip root level when startLevel is 1', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.', { startLevel: 1 });

      // Should still find the host node (it's included because it has matching children)
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.text).toBe('Host1');
      
      // Should find the system database node
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      expect(systemNode?.children?.length).toBe(4);
    });

    it('should work with multi-segment search and startLevel', () => {
      const tree = createTestTree();
      const result = searchTree(tree, 'system.metric', { startLevel: 1 });

      // Host node should be included (has matching children)
      expect(result.length).toBeGreaterThan(0);
      const systemNode = result[0]?.children?.find((node) => node.text === 'system');
      expect(systemNode).toBeDefined();
      
      // Should show metric_log and metrics
      const childrenNames = systemNode?.children?.map((c) => c.text) || [];
      expect(childrenNames).toContain('metric_log');
      expect(childrenNames).toContain('metrics');
    });
  });
});

