import os
import django

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

# List of dummy doctor and nurse accounts to register
doctors_data = [
  {
    "username": "doctor1",
    "email": "doctor1@ispeak.com",
    "password": "password123",
    "first_name": "Sarah",
    "last_name": "Jenkins",
    "is_staff": True,  # Enables permission to add patients
  },
  {
    "username": "nurse1",
    "email": "nurse1@ispeak.com",
    "password": "password123",
    "first_name": "Emily",
    "last_name": "Smith",
    "is_staff": True,
  },
  {
    "username": "doctor2",
    "email": "doctor2@ispeak.com",
    "password": "password123",
    "first_name": "Robert",
    "last_name": "Chen",
    "is_staff": True,
  }
]

print("--- Seeding Clinician / Doctor Accounts ---")

for doc in doctors_data:
  user, created = User.objects.get_or_create(
    username=doc["username"],
    defaults={
      "email": doc["email"],
      "first_name": doc["first_name"],
      "last_name": doc["last_name"],
      "is_staff": doc["is_staff"],
    }
  )
  if created:
    user.set_password(doc["password"])
    user.save()
    print(f"[CREATED] {doc['first_name']} {doc['last_name']} (Username: '{doc['username']}', Password: '{doc['password']}')")
  else:
    # If it already exists, let's update their staff status and password to ensure it's active
    user.email = doc["email"]
    user.first_name = doc["first_name"]
    user.last_name = doc["last_name"]
    user.is_staff = doc["is_staff"]
    user.set_password(doc["password"])
    user.save()
    print(f"[UPDATED] {doc['first_name']} {doc['last_name']} (Username: '{doc['username']}', Password: '{doc['password']}')")

print("------------------------------------------")
print("Done! You can now log into these accounts via your clinican portal.")
