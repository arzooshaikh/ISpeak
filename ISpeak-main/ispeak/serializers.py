from rest_framework import serializers
from .models import Patient, SymptomReport, SOSAlert, CalibrationData
from utils.clinical_notes import generate_clinical_note


class PatientSerializer(serializers.ModelSerializer):
    roomNumber = serializers.CharField(source='room_number')
    lastReportTimestamp = serializers.SerializerMethodField()
    alertStatus = serializers.SerializerMethodField()
    hasUnreadReport = serializers.SerializerMethodField()
    hasActiveAnomaly = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'patient_id','name', 'roomNumber', 'date_of_birth', 'diagnosis',
            'is_active', 'lastReportTimestamp', 'alertStatus',
            'hasUnreadReport', 'hasActiveAnomaly',
        ]

    def get_lastReportTimestamp(self, obj):
        latest = obj.reports.order_by('-timestamp').first()
        if latest:
            return latest.timestamp.isoformat()
        return None

    def get_alertStatus(self, obj):
        return obj.get_alert_status()

    def get_hasUnreadReport(self, obj):
        return obj.has_unread_report()

    def get_hasActiveAnomaly(self, obj):
        return obj.has_active_anomaly()


class PatientCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['patient_id','name', 'room_number', 'date_of_birth', 'diagnosis', 'is_active']

class SymptomReportSerializer(serializers.ModelSerializer):
    patientId = serializers.IntegerField(source='patient_id')
    bodyPart = serializers.CharField(source='body_part')
    painType = serializers.CharField(source='pain_type')
    clinicalNote = serializers.CharField(source='clinical_note', read_only=True)
    isAnomaly = serializers.BooleanField(source='is_anomaly', read_only=True)
    anomalyMessage = serializers.CharField(source='anomaly_message', read_only=True)

    class Meta:
        model = SymptomReport
        fields = [
            'id', 'patientId', 'emotion', 'bodyPart', 'severity',
            'painType', 'clinicalNote', 'isAnomaly', 'anomalyMessage', 'timestamp',
        ]
        read_only_fields = ['id', 'clinicalNote', 'isAnomaly', 'anomalyMessage', 'timestamp']

    def validate_severity(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('severity must be between 1 and 5.')
        return value

    def create(self, validated_data):
        patient_id = validated_data.pop('patient_id')
        patient = Patient.objects.get(pk=patient_id)
        report = SymptomReport.objects.create(patient=patient, **validated_data)
        try:
            note = generate_clinical_note(
                emotion=report.emotion,
                body_part=report.body_part,
                severity=report.severity,
                pain_type=report.pain_type,
                patient_name=patient.name,
            )
            report.clinical_note = note
            report.save(update_fields=['clinical_note'])
        except Exception:
            pass
        return report


class SOSAlertSerializer(serializers.ModelSerializer):
    patientId = serializers.IntegerField(source='patient_id')
    bodyPart = serializers.CharField(source='body_part', required=False, allow_blank=True)
    painType = serializers.CharField(source='pain_type', required=False, allow_blank=True)

    class Meta:
        model = SOSAlert
        fields = [
            'id', 'patientId', 'emotion', 'bodyPart', 'severity',
            'painType', 'timestamp', 'acknowledged',
        ]
        read_only_fields = ['id', 'timestamp']

    def create(self, validated_data):
        patient_id = validated_data.pop('patient_id')
        patient = Patient.objects.get(pk=patient_id)
        return SOSAlert.objects.create(patient=patient, **validated_data)


class CalibrationDataSerializer(serializers.ModelSerializer):
    patientId = serializers.IntegerField(source='patient_id', write_only=True)
    gazeX = serializers.FloatField(source='gaze_x')
    gazeY = serializers.FloatField(source='gaze_y')
    screenX = serializers.FloatField(source='screen_x')
    screenY = serializers.FloatField(source='screen_y')
    sessionId = serializers.CharField(source='session_id')

    class Meta:
        model = CalibrationData
        fields = [
            'id', 'patientId', 'gazeX', 'gazeY', 'screenX', 'screenY',
            'sessionId', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        patient_id = validated_data.pop('patient_id')
        patient = Patient.objects.get(pk=patient_id)
        return CalibrationData.objects.create(patient=patient, **validated_data)