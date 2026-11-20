# BFocused — Job Application Tracker

BFocused is a responsive, frontend-only job and internship application tracker built with **HTML5, CSS3, and vanilla JavaScript**. It is designed as a portfolio project for students managing internships and placements.

## Features

- Dashboard with application, active-stage, interview, and offer statistics
- Create, view, edit, and delete applications
- Kanban board with native drag-and-drop status changes
- Search, filter, and sort applications
- Deadline and follow-up planner with in-app reminders
- Application status history
- Table and card views
- Local persistence with `localStorage`
- CSV export and import
- Dark mode
- Responsive desktop, tablet, and mobile layout
- Demo data for quick testing

## Tech stack

- HTML5
- CSS3 (Grid, Flexbox, media queries, CSS variables)
- Vanilla JavaScript
- Browser APIs: localStorage, Drag and Drop, File, Blob, and URL APIs

No frameworks, backend, database, package manager, or external JavaScript libraries are required.

## Run in VS Code

1. Extract the `BFocused` folder.
2. Open the folder in VS Code.
3. Open `index.html` in your browser.

You can also use the VS Code **Live Server** extension if it is already installed, but it is not required.

## Data and privacy

Application records are stored in the browser's `localStorage`. Data is not synchronized across browsers or devices. Use **Export CSV** to make a backup before clearing browser data.

The reminder system displays due dates when the app is open. It does not send server-backed email or push notifications.

## Suggested GitHub description

A responsive job application tracker built using HTML, CSS, and vanilla JavaScript. Features include a drag-and-drop Kanban board, application analytics, deadline reminders, localStorage persistence, CSV import/export, and dark mode.
