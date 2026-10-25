"""
ispeak/gaze_consumer.py

Django Channels WebSocket consumer that:
1. Starts the Orlosky pupil tracker (singleton — shared across all clients)
2. Streams gaze events to each connected browser client as JSON
3. Receives calibration commands from the frontend and persists them
   (the frontend still handles the calibration math; we just relay raw rx/ry)

WebSocket URL:  ws://<host>/ws/gaze/

Messages sent TO the browser (server → client):
  { "type": "ready" }
  { "type": "gaze",  "rx": 0.52, "ry": 0.48, "conf": 0.91 }
  { "type": "blink" }
  { "type": "hold" }
  { "type": "error", "message": "..." }

Messages received FROM the browser (client → server):
  { "type": "ping" }   → ignored / keep-alive
"""

import asyncio
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

# How many seconds to sleep between queue polls (keeps CPU low)
POLL_INTERVAL = 0.008   # ~125 Hz poll rate → effectively FPS-limited by the tracker


class GazeConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        await self.accept()
        logger.info("[GazeConsumer] Client connected: %s", self.channel_name)

        # Lazily import here to avoid import at startup before Django is ready
        from utils.orlosky_pupil_tracker import get_tracker
        self._tracker = get_tracker()

        # Start the background loop that forwards tracker events to this socket
        self._streaming = True
        self._stream_task = asyncio.ensure_future(self._stream_gaze())

    async def disconnect(self, close_code):
        self._streaming = False
        if hasattr(self, "_stream_task"):
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass
        logger.info("[GazeConsumer] Client disconnected: %s", self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Handle messages from the browser (currently just ping/keep-alive)."""
        if not text_data:
            return
        try:
            msg = json.loads(text_data)
            if msg.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
        except Exception:
            pass

    async def _stream_gaze(self):
        """
        Background coroutine: drain the tracker's queue and forward
        each event to the connected WebSocket client.
        """
        import queue as _queue

        q = self._tracker.queue
        while self._streaming:
            try:
                # Non-blocking queue read
                item = q.get_nowait()
                await self.send(text_data=json.dumps(item))
            except _queue.Empty:
                # Nothing ready yet — yield control briefly
                await asyncio.sleep(POLL_INTERVAL)
            except Exception as exc:
                logger.error("[GazeConsumer] Stream error: %s", exc)
                await asyncio.sleep(POLL_INTERVAL)
