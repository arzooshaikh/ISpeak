from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User


class Patient(models.Model):
    id = models.AutoField(primary_key=True)
    patient_id = models.CharField(
    max_length=20,
    )
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients', null=True, blank=True)
    name = models.CharField(max_length=200)
    room_number = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    diagnosis = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.room_number})"

    def get_alert_status(self):
        latest = self.reports.order_by('-timestamp').first()
        if latest is None:
            return 'green'
        if latest.is_anomaly or latest.severity >= 4:
            return 'red'
        if latest.severity == 3:
            return 'amber'
        return 'green'

    def has_unread_report(self):
        cutoff = timezone.now() - timedelta(hours=24)
        return self.reports.filter(timestamp__gte=cutoff).exists()

    def has_active_anomaly(self):
        latest = self.reports.order_by('-timestamp').first()
        return bool(latest and latest.is_anomaly)


class SymptomReport(models.Model):
    EMOTION_CHOICES = [
        ('happy', 'happy'),
        ('neutral', 'neutral'),
        ('pain', 'pain'),
    ]
    BODY_CHOICES = [
        ('head', 'head'),
        ('neck', 'neck'),
        ('chest', 'chest'),
        ('left_arm', 'left_arm'),
        ('right_arm', 'right_arm'),
        ('stomach', 'stomach'),
        ('back', 'back'),
        ('left_leg', 'left_leg'),
        ('right_leg', 'right_leg'),
    ]
    PAIN_CHOICES = [
        ('sharp', 'sharp'),
        ('burning', 'burning'),
        ('pressure', 'pressure'),
        ('throbbing', 'throbbing'),
        ('numb', 'numb'),
        ('cant_describe', 'cant_describe'),
    ]

    id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='reports')
    emotion = models.CharField(max_length=20, choices=EMOTION_CHOICES)
    body_part = models.CharField(max_length=30, choices=BODY_CHOICES)
    severity = models.IntegerField()
    pain_type = models.CharField(max_length=30, choices=PAIN_CHOICES)
    clinical_note = models.TextField(blank=True)
    is_anomaly = models.BooleanField(default=False)
    anomaly_message = models.TextField(blank=True)
    submitted_via_gaze = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report #{self.id} — {self.patient.name} @ {self.timestamp:%Y-%m-%d %H:%M}"


class SOSAlert(models.Model):
    id = models.AutoField(primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='sos_alerts')
    emotion = models.CharField(max_length=20, blank=True)
    body_part = models.CharField(max_length=30, blank=True)
    severity = models.IntegerField(null=True, blank=True)
    pain_type = models.CharField(max_length=30, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)

    def __str__(self):
        return f"SOS #{self.id} — {self.patient.name} (ack={self.acknowledged})"


class CalibrationData(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='calibrations')
    gaze_x = models.FloatField()
    gaze_y = models.FloatField()
    screen_x = models.FloatField()
    screen_y = models.FloatField()
    session_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Calibration — {self.patient.name} [{self.session_id}]"