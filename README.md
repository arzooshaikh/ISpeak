# ISpeak — Eye-Gaze Communication System

**ISpeak** is an assistive communication platform designed to help individuals with speech impairments communicate independently using eye movements. It enables users to select words through eye-gaze interaction, generate messages, express their needs, and trigger SOS alerts when assistance is required.

The platform also includes a Django backend for patient management, symptom reporting, and AI-assisted clinical insights.

## ✨ Features

- **Eye-Gaze Communication:** Select words and interact with the communication interface using eye movements.
- **Message Generation:** Build messages to express needs, thoughts, and requests.
- **SOS Alerts:** Provide an emergency alert feature for situations requiring assistance.
- **Patient Management:** Manage patient-related information through the Django backend.
- **Symptom Reporting:** Record and manage reported symptoms.
- **AI-Assisted Clinical Insights:** Support clinical workflows with AI-assisted insights.
- **Accessibility-Focused Design:** Promote independent communication for people with speech impairments.

## 🛠️ Tech Stack

- **Frontend:** JavaScript, React, Vite
- **Backend:** Python, Django
- **Dependencies:** Node.js/npm and Python packages listed in `requirements.txt`
- **Configuration:** Environment variables using `.env` configuration

## 📁 Project Structure

```text
ISpeak/
├── config/              # Django configuration
├── ispeak/              # Django application
├── src/                 # Frontend source code
├── utils/                # Utility modules
├── manage.py             # Django management script
├── requirements.txt      # Python dependencies
├── package.json         # Frontend dependencies and scripts
├── vite.config.js       # Vite configuration
├── index.html           # Frontend entry HTML
└── .env.example         # Example environment configuration
```

## 🚀 Getting Started

### Prerequisites

Install the following before running the project:

- Python 3.x
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/arzooshaikh/ISpeak.git
cd ISpeak
```

### 2. Set Up the Frontend

```bash
npm install
npm run dev
```

Follow the local URL displayed by Vite to open the frontend.

### 3. Set Up the Backend

Create and activate a virtual environment:

```bash
python -m venv venv
```

On Windows:

```bash
venv\Scripts\activate
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables using `.env.example` as a reference. Set any required values before starting the application.

Run database migrations and start Django:

```bash
python manage.py migrate
python manage.py runserver
```

The Django development server is typically available at `http://127.0.0.1:8000/`.

> **Note:** The exact environment variables, database configuration, and startup requirements depend on the project's current implementation.

## 💡 How It Works

1. The user interacts with the interface through eye-gaze input.
2. The system supports word selection and message composition.
3. Users can communicate their needs through generated messages.
4. An SOS feature provides a way to request assistance.
5. The Django backend supports patient management, symptom reporting, and AI-assisted clinical insights.

## 🎯 Project Goal

ISpeak aims to make communication more accessible, encourage independence, and support individuals who face challenges with verbal communication through assistive technology.

## 🔮 Future Enhancements

- Improved eye-gaze calibration and tracking accuracy.
- Text-to-speech output for generated messages.
- Multilingual communication support.
- Enhanced emergency notification workflows.
- Further accessibility and usability improvements.

## 🤝 Contributing

Contributions and suggestions that improve accessibility, usability, and communication support are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request describing your improvements.


**ISpeak — Empowering communication through eye movements.**
