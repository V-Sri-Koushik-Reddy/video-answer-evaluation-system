# AI Video Answer Evaluator

An end-to-end AI-based system that evaluates spoken video answers by processing audio, converting speech to text, analyzing semantic similarity with a reference answer, and generating chunk-wise as well as final scores through a dashboard.

## Project Overview

This project takes a student's video response as input and processes it through a complete evaluation pipeline:

Video Input
↓
Audio and Frame Extraction
↓
Speech-to-Text Conversion
↓
Timestamp-Based Segmentation
↓
Text Preprocessing
↓
Semantic Understanding
↓
Keyword and Filler Analysis
↓
Visual Activity Analysis
↓
Chunk-wise Scoring
↓
Final Aggregated Evaluation
↓
Dashboard Visualization

The system is designed as a working MVP for hackathon/demo use cases where spoken answers need to be evaluated automatically.

## Features

- Extracts audio from uploaded video using FFmpeg
- Converts speech to text using Whisper
- Splits transcript into timestamp-based chunks
- Performs semantic similarity scoring against a reference answer
- Adds keyword coverage analysis
- Adds filler-word penalty
- Performs lightweight visual activity analysis from video frames
- Generates structured timeline output
- Displays final results in a React dashboard

## Tech Stack

### Backend
- Python
- FFmpeg
- Whisper
- Sentence Transformers
- OpenCV
- NumPy

### Frontend
- React
- Vite
- Framer Motion
- Lucide React

## Folder Structure

```bash
ai-video-answer-evaluator/
├── backend/
│   ├── app.py
│   ├── input/
│   │   ├── student.mp4
│   │   └── reference.txt
│   ├── output/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── EvaluationDashboard.jsx
│   │   └── index.css
│   ├── package.json
│   └── ...
│
├── screenshots/
│   ├── pipeline.png
│   ├── dashboard.png
│   └── result.png
│
├── .gitignore
└── README.md
