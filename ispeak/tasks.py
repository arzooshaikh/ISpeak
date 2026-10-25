import logging
from celery import shared_task
from .models import Patient
from utils.ws_broadcast import broadcast_to_dashboard

logger = logging.getLogger(__name__)


@shared_task(name='ispeak.tasks.trigger_daily_checkin', bind=True, max_retries=3)
def trigger_daily_checkin(self):
    active_patients = Patient.objects.filter(is_active=True)
    count = active_patients.count()
    logger.info('trigger_daily_checkin: broadcasting to %d active patients.', count)

    for patient in active_patients:
        try:
            broadcast_to_dashboard('checkinPrompt', {
                'patientId': patient.id,
                'patientName': patient.name,
                'roomNumber': patient.room_number,
            })
        except Exception as exc:
            logger.error(
                'Failed to broadcast checkinPrompt for patient %d: %s',
                patient.id, exc, exc_info=True,
            )

    return f'Check-in prompts sent for {count} patients.'