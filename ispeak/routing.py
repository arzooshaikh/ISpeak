from django.urls import re_path
from . import consumers
from . import gaze_consumer

websocket_urlpatterns = [
    re_path(r'ws/dashboard/$', consumers.DashboardConsumer.as_asgi()),
    re_path(r'ws/gaze/$',      gaze_consumer.GazeConsumer.as_asgi()),
]