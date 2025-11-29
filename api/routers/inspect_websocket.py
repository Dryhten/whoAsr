"""WebSocket routes for speech recognition API with inspect_id support"""

import json
from fastapi import WebSocket, WebSocketDisconnect, Query
from ..core.inspect_connection import inspect_manager
from ..core.config import logger


async def inspect_websocket_endpoint(
    websocket: WebSocket, client_id: str, inspect_id: str = Query(..., description="巡检ID，用于归类语音检测")
):
    """WebSocket endpoint for real-time speech recognition with inspect_id"""
    await inspect_manager.connect(websocket, client_id, inspect_id)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "start_recording":
                await inspect_manager.handle_start_recording(client_id)

            elif message["type"] == "stop_recording":
                await inspect_manager.handle_stop_recording(client_id)

            elif message["type"] == "audio_chunk":
                await inspect_manager.handle_audio_chunk(client_id, message["data"])

            elif message["type"] == "ping":
                # 处理心跳消息，回复 pong
                await inspect_manager.send_message(client_id, {"type": "pong"})

            else:
                logger.warning(f"Unknown message type: {message['type']}")
                await inspect_manager.send_message(
                    client_id,
                    {
                        "type": "error",
                        "message": f"Unknown message type: {message['type']}",
                    },
                )

    except WebSocketDisconnect:
        inspect_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await inspect_manager.send_message(client_id, {"type": "error", "message": f"Connection error: {str(e)}"})
        inspect_manager.disconnect(client_id)
