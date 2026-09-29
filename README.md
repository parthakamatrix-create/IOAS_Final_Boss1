# IOAS - Intelligent Opportunity Aggregation System

A fullstack web application that aggregates hackathons, competitions, and Scopus-indexed conferences from multiple platforms (Unstop, Devfolio, Devpost, IEEE, ACM) with automated deadline alert notifications and conversational assistant capabilities.

## Features

- **Consolidated Dashboard**: View verified hackathons, coding competitions, and conferences with registration and submission deadlines.
- **Scopus Verification**: Clear visual badges for verified Scopus-indexed research conferences with key milestone tracking (Registration, Submission, Notification, Camera-Ready).
- **Automated Aggregation Pipeline**: Scrapes live opportunities with duplicate detection, date synchronization, and multi-source ingestion.
- **Personalized Alerts**: Subscribe with customizable interest keywords, engineering branches, and preferred opportunity types.
- **Alert Dispatch Rules**: Automated urgency triggers (7-day, 3-day, 24-hour, and final-day deadline warnings).
- **Interactive Chatbot**: Endpoint supporting conversational queries and instant subscription via WhatsApp/Telegram or Gemini AI integration.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build
npm run build
```

The application runs on port `3000`.
