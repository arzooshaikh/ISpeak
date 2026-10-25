from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import Patient, SymptomReport, SOSAlert, CalibrationData
from .serializers import (
    PatientSerializer, PatientCreateSerializer,
    SymptomReportSerializer, SOSAlertSerializer, CalibrationDataSerializer,
)
from utils.ws_broadcast import broadcast_to_dashboard


def run_anomaly_check(report):
    if report.severity == 5 and report.emotion == 'pain':
        return True, 'High severity pain alert detected.'
    return False, ''


class SymptomReportViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = SymptomReportSerializer

    def get_permissions(self):
        if self.action == "create":
            return []

        return [IsAuthenticated()]

    def get_queryset(self):
        qs = SymptomReport.objects.select_related('patient').order_by('-timestamp')
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        days = self.request.query_params.get('days')
        if days:
            try:
                cutoff = timezone.now() - timedelta(days=int(days))
                qs = qs.filter(timestamp__gte=cutoff)
            except (ValueError, TypeError):
                pass
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save()

        # Generate clinical note
        try:
            from utils.clinical_notes import generate_clinical_note
            note = generate_clinical_note(report.patient, report)
            report.clinical_note = note
            report.save(update_fields=['clinical_note'])
            print(f"[Clinical Note] Generated: {note[:80]}...")
        except Exception as e:
            print(f"[Clinical Note Error] {e}")

        is_anomaly, anomaly_message = run_anomaly_check(report)
        if is_anomaly or anomaly_message:
            report.is_anomaly = is_anomaly
            report.anomaly_message = anomaly_message
            report.save(update_fields=['is_anomaly', 'anomaly_message'])

        broadcast_to_dashboard('newReport', {
            'patientId': report.patient_id,
            'severity': report.severity,
            'bodyPart': report.body_part,
            'timestamp': report.timestamp.isoformat(),
            'isAnomaly': report.is_anomaly,
        })

        return Response(
            self.get_serializer(report).data,
            status=status.HTTP_201_CREATED,
        )


class PatientViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        return PatientSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminUser()]

        if self.action == 'list':
            return []

        return [IsAuthenticated()]

    def get_queryset(self):
        return Patient.objects.filter(is_active=True).order_by('name')

    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)

    @action(detail=True, methods=['get'], url_path='trends')
    def trends(self, request, pk=None):
        patient = self.get_object()
        cutoff = timezone.now() - timedelta(days=30)
        reports = SymptomReport.objects.filter(
            patient=patient, timestamp__gte=cutoff,
        ).order_by('timestamp').values('timestamp', 'body_part', 'severity')

        trends = [
            {
                'date': r['timestamp'].strftime('%Y-%m-%d'),
                'bodyPart': r['body_part'],
                'severity': r['severity'],
            }
            for r in reports
        ]
        return Response({'patientId': patient.id, 'trends': trends})


class SOSAlertViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = SOSAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SOSAlert.objects.select_related('patient').order_by('-timestamp')
        acknowledged = self.request.query_params.get('acknowledged')
        if acknowledged is not None and acknowledged.lower() == 'false':
            qs = qs.filter(acknowledged=False)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        session = data.pop('sessionSelections', None)
        if session and isinstance(session, dict):
            data.setdefault('emotion', session.get('emotion', ''))
            data.setdefault('bodyPart', session.get('bodyPart', ''))
            data.setdefault('severity', session.get('severity'))
            data.setdefault('painType', session.get('painType', ''))

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        alert = serializer.save()

        broadcast_to_dashboard('sosAlert', {
            'alertId': alert.id,
            'patientId': alert.patient_id,
            'patientName': alert.patient.name,
            'roomNumber': alert.patient.room_number,
            'severity': alert.severity,
            'bodyPart': alert.body_part,
            'timestamp': alert.timestamp.isoformat(),
        })
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


class CalibrationDataViewSet(
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CalibrationDataSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CalibrationData.objects.none()