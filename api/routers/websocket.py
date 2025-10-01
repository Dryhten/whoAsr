"""WebSocket routes for speech recognition API"""

import json
from fastapi import WebSocket, WebSocketDisconnect
from ..core.connection import manager
from ..core.config import logger


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time speech recognition"""
    await manager.connect(websocket, client_id)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "start_recording":
                await manager.handle_start_recording(client_id)

            elif message["type"] == "stop_recording":
                await manager.handle_stop_recording(client_id)

            elif message["type"] == "audio_chunk":
                await manager.handle_audio_chunk(client_id, message["data"])

            else:
                logger.warning(f"Unknown message type: {message['type']}")
                await manager.send_message(
                    client_id,
                    {
                        "type": "error",
                        "message": f"Unknown message type: {message['type']}",
                    },
                )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await manager.send_message(
            client_id, {"type": "error", "message": f"Connection error: {str(e)}"}
        )
        manager.disconnect(client_id)
