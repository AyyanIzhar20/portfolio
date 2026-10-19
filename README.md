# Ayyan Izhar — Portfolio

Personal portfolio site. Static HTML/CSS/JS, no build step.

- Live: https://ayyanizhar20.github.io/portfolio/
- Local preview: `python -m http.server 5173` in this folder, then open http://localhost:5173

## Structure

- `index.html` — home (hero, about, selected work, experience, capabilities)
- `projects/` — one page per project
- `assets/css/` — design tokens + stylesheet
- `assets/js/` — motion system (menu, transitions, scroll, previews, form)
- `assets/img`, `assets/video` — media

## Contact form

The inquiry form posts to Web3Forms. Add your access key as the `data-key`
attribute on the `form[data-inquiry]` element in each HTML file.
Until a key is set, the submit button falls back to opening the visitor's
email app with the inquiry pre-filled.
