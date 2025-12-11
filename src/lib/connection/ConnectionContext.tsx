import React, { createContext, useContext, useEffect, useState } from "react";
import { ensureConnectionRuntimeInitialized, type Connection } from "./Connection";
import { ConnectionManager } from "./ConnectionManager";

interface ConnectionContextType {
  selectedConnection: Connection | null;
  setSelectedConnection: (conn: Connection | null) => void;
  hasAnyConnections: boolean;
}

export const ConnectionContext = createContext<ConnectionContextType>({
  selectedConnection: null,
  setSelectedConnection: () => {
    // Default implementation - will be overridden by provider
  },
  hasAnyConnections: false,
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedConnection, setSelectedConnectionState] = useState<Connection | null>(null);
  const [hasAnyConnections, setHasAnyConnections] = useState<boolean>(false);

  // Load connection on mount
  useEffect(() => {
    const savedConnection = ConnectionManager.getInstance().getLastSelectedOrFirst();
    const connections = ConnectionManager.getInstance().getConnections();
    setHasAnyConnections(connections.length > 0);

    if (savedConnection) {
      // Just set it, don't initialize here
      setSelectedConnectionState(ensureConnectionRuntimeInitialized(savedConnection));
    }
  }, []);

  const setSelectedConnection = async (conn: Connection | null) => {
    if (conn !== null) {
      setSelectedConnectionState(ensureConnectionRuntimeInitialized(conn));
      
      ConnectionManager.getInstance().saveLastSelected(conn?.name);
      setHasAnyConnections(true);
    } else {
      setSelectedConnectionState(null);
      ConnectionManager.getInstance().saveLastSelected(undefined);
      const connections = ConnectionManager.getInstance().getConnections();
      setHasAnyConnections(connections.length > 0);
    }
  };

  return (
    <ConnectionContext.Provider value={{ selectedConnection, setSelectedConnection, hasAnyConnections }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export const useConnection = () => useContext(ConnectionContext);
