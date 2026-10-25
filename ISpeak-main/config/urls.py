from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from ispeak.views import (
    PatientViewSet,
    SymptomReportViewSet,
    SOSAlertViewSet,
    CalibrationDataViewSet,
)

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'reports', SymptomReportViewSet, basename='report')
router.register(r'sos', SOSAlertViewSet, basename='sos')
router.register(r'calibration', CalibrationDataViewSet, basename='calibration')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair2'),  
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]