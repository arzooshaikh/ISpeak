import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_clinical_note(patient, report):
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a clinical documentation assistant."},
                {"role": "user", "content": f"""
Patient Name: {patient.name}
Room: {patient.room_number}
Body Part: {report.body_part}
Pain Type: {report.pain_type}
Pain Level: {report.severity}/10
Timestamp: {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

Write a concise professional clinical note (3-5 sentences) for the attending physician.
"""}
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"[Groq Error] {e}")
        return (
            f"Patient {patient.name} in {patient.room_number} reported "
            f"{report.pain_type} pain (level {report.severity}/10) "
            f"in the {report.body_part} area. Please review promptly."
        )