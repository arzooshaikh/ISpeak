import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def broadcast_to_dashboard(message_type: str, payload: dict) -> None:
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'dashboard',
            {
                'type': 'dashboard_message',
                'message': {
                    'type': message_type,
                    'payload': payload,
                },
            },
        )
    except Exception as exc:
        logger.error('broadcast_to_dashboard failed: %s', exc, exc_info=True)