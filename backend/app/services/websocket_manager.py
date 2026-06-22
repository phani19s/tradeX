import asyncio
import json
from collections import defaultdict


class ConnectionManager:
    def __init__(self):
        self.active_connections = defaultdict(list)

    async def connect(self, user_id: int, websocket):
        if websocket.client_state.name != "CONNECTED":
            await websocket.accept()
        self.active_connections[user_id].append(
            {
                "websocket": websocket,
                "loop": asyncio.get_running_loop(),
            }
        )

    def disconnect(self, user_id: int, websocket):
        connections = self.active_connections.get(user_id, [])
        self.active_connections[user_id] = [
            connection
            for connection in connections
            if connection["websocket"] is not websocket
        ]

        if not self.active_connections[user_id]:
            self.active_connections.pop(user_id, None)

    async def _send(self, websocket, payload):
        await websocket.send_text(json.dumps(payload))

    def send_to_user(self, user_id: int, payload: dict):
        stale = []

        for connection in self.active_connections.get(user_id, []):
            future = asyncio.run_coroutine_threadsafe(
                self._send(connection["websocket"], payload),
                connection["loop"],
            )

            try:
                future.result(timeout=2)
            except Exception:
                stale.append(connection)

        if stale:
            self.active_connections[user_id] = [
                connection
                for connection in self.active_connections.get(user_id, [])
                if connection not in stale
            ]


notification_manager = ConnectionManager()
