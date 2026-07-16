"""
Django settings for Inventra backend.
"""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-change-me-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1,10.0.2.2,testserver' if not DEBUG else '*',
    cast=Csv(),
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'common',
    'companies',
    'accounts',
    'authentication',
    'branches',
    'warehouses',
    'units',
    'categories',
    'brands',
    'products',
    'customers',
    'suppliers',
    'inventory',
    'sales',
    'payments',
    'purchases',
    'expenses',
    'employees',
    'notifications',
    'settings_app',
    'dashboard',
    'reports',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

DB_ENGINE = config('DB_ENGINE', default='django.db.backends.sqlite3')
if DB_ENGINE == 'django.db.backends.postgresql':
    DATABASES = {
        'default': {
            'ENGINE': DB_ENGINE,
            'NAME': config('DB_NAME', default='inventra'),
            'USER': config('DB_USER', default='inventra'),
            'PASSWORD': config('DB_PASSWORD', default='inventra'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Dakar'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:8081,http://localhost:19006',
    cast=Csv(),
)
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=DEBUG, cast=bool)

# Wave Business API
WAVE_API_KEY = config('WAVE_API_KEY', default='')
WAVE_WEBHOOK_SECRET = config('WAVE_WEBHOOK_SECRET', default='')
WAVE_API_BASE_URL = config('WAVE_API_BASE_URL', default='https://api.wave.com')
WAVE_SUCCESS_URL = config('WAVE_SUCCESS_URL', default='https://inventra.sn/payment/success')
WAVE_ERROR_URL = config('WAVE_ERROR_URL', default='https://inventra.sn/payment/error')

# Orange Money Web Payment
ORANGE_MONEY_CLIENT_ID = config('ORANGE_MONEY_CLIENT_ID', default='')
ORANGE_MONEY_CLIENT_SECRET = config('ORANGE_MONEY_CLIENT_SECRET', default='')
ORANGE_MONEY_MERCHANT_KEY = config('ORANGE_MONEY_MERCHANT_KEY', default='')
ORANGE_MONEY_TOKEN_URL = config('ORANGE_MONEY_TOKEN_URL', default='https://api.orange.com/oauth/v3/token')
ORANGE_MONEY_API_BASE_URL = config(
    'ORANGE_MONEY_API_BASE_URL',
    default='https://api.orange.com/orange-money-webpay/dev/v1',
)
ORANGE_MONEY_NOTIF_URL = config('ORANGE_MONEY_NOTIF_URL', default='')

# MTN Mobile Money Collection
MTN_MOMO_API_KEY = config('MTN_MOMO_API_KEY', default='')
MTN_MOMO_SUBSCRIPTION_KEY = config('MTN_MOMO_SUBSCRIPTION_KEY', default='')
MTN_MOMO_API_BASE_URL = config('MTN_MOMO_API_BASE_URL', default='https://sandbox.momodeveloper.mtn.com')
MTN_MOMO_TARGET_ENVIRONMENT = config('MTN_MOMO_TARGET_ENVIRONMENT', default='sandbox')
MTN_MOMO_DEFAULT_PAYER = config('MTN_MOMO_DEFAULT_PAYER', default='22997000000')

# URL de base pour les redirections mock en DEBUG
PAYMENT_MOCK_BASE_URL = config('PAYMENT_MOCK_BASE_URL', default='http://localhost:5173')

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
