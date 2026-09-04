import type { Role } from "../security/types.js";

export interface AuthenticatedClient {
  id: string;
  name: string;
  role: Role;
}

interface ApiClient extends AuthenticatedClient {
  apiKey: string;
}

const apiClients: ApiClient[] = [
  {
    id: "client-viewer-001",
    name: "Viewer Client",
    role: "viewer",
    apiKey: "viewer-secret-key",
  },
  {
    id: "client-developer-001",
    name: "Developer Client",
    role: "developer",
    apiKey: "developer-secret-key",
  },
  {
    id: "client-admin-001",
    name: "Admin Client",
    role: "admin",
    apiKey: "admin-secret-key",
  },
];

export function authenticateApiKey(
  apiKey: string | undefined,
): AuthenticatedClient | null {
  if (!apiKey) {
    return null;
  }

  const client = apiClients.find((item) => item.apiKey === apiKey);

  if (!client) {
    return null;
  }

  return {
    id: client.id,
    name: client.name,
    role: client.role,
  };
}
