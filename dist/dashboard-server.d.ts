/**
 * Agent Dashboard Server
 * Real-time monitoring and visualization of all agents
 * WebSocket streaming of live agent events and metrics
 */
import http from 'http';
import WebSocket from 'ws';
declare const app: import("express-serve-static-core").Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
declare const wss: WebSocket.Server<typeof WebSocket, typeof http.IncomingMessage>;
/**
 * Start server
 */
export declare function startDashboardServer(port?: number): void;
export { app, server, wss };
//# sourceMappingURL=dashboard-server.d.ts.map