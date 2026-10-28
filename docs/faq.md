# FAQ

## Where does the data come from?
From the monthly crime files the St. Louis Metropolitan Police Department (SLMPD) publishes on its [downloads page](https://slmpd.org/stats/slmpd-downloadable-crime-files/). This project is independent and is not affiliated with or endorsed by SLMPD or the City of St. Louis.

## Why does a month have fewer rows than the file I downloaded?
SLMPD files include late-reported and updated records from earlier months. The pipeline keeps only records whose incident date falls in the month you asked for, and drops rows with no usable coordinates or coordinates outside the city limits. Both steps are intentional.

## What about the missing times?
Some records have no time of day. The pipeline fills them with 00:00 so the date is kept. A midnight (and noon) time is therefore ambiguous. The Explorer leaves 00:00 and 12:00 records out of its time-of-day charts for that reason; they still count everywhere else. Flagging missing times at the source is on the to-do list.

## Do I get the raw CSV files?
Not by default. The pipeline downloads, cleans and discards them. If you want a copy of one file, call `geocrime_stl.etl.extract.fetch_crime_data_csv(url, keep_raw_csv=True)` yourself, which saves it in the current folder.

## A month fails to download. Why?
Usually the month has not been published yet (SLMPD typically posts the previous month in the first half of the following month). It can also mean SLMPD changed its file layout. [Open an issue](https://github.com/lweber89/geocrime-stl/issues) with the month and the message you saw.

## Is the Explorer the same data?
Yes. It is built from the same cleaned monthly data, with one addition: sensitive offenses are counted but shown without an address or dot. See the [Explorer guide](about-explorer.md).

## Why a circle around a pin, and not a walking-time area?
The Explorer is meant for looking at what was reported near a place, with controls anyone can follow: everything within a chosen distance. A walking-time area (an isochrone) was suggested and considered. It would need a street network and a routing calculation, and it would make the result look more precise than the data supports. Offenses are block-level addresses reported by different people at different rates, so they cannot say how exposed someone is on a particular walk. That moves from exploring the data to analyzing it, so the Explorer keeps simple distance rings. If you need walking-time analysis, the cleaned data is available for GIS tools through the package.

## Can I contribute?
Not code, for now (see [Contributing](contributing.md)), but bug reports and ideas are welcome as issues.
