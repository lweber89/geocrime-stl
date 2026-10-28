# Contributing

This is a personal project I maintain to learn geospatial data engineering with Python, so **I am not accepting pull requests** at this time. Forking the repository to adapt it for your own needs is welcome (MIT license).

## Reporting a problem or an idea

[Open an issue](https://github.com/lweber89/geocrime-stl/issues/new/choose) and pick the form that fits:

- **Something is broken or looks wrong**: a page misbehaves.
- **A number or data point looks wrong**: a count, date, location or category.
- **Idea or polish**: a feature, wording, design or accessibility suggestion.

The most useful thing you can add is the link from your browser's address bar. The Explorer keeps its whole view (offense, period, ward, pin, tab) in the link, so I can see exactly what you saw. Please do not include personal information about anyone.

## For people running a fork

    pip install -e .
    python -m unittest discover -s tests          # Python tests
    node --test tests/js/hotspots.test.js         # dashboard tests (Node 18+)
