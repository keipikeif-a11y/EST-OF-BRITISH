# Mapbox Time Slider Steps

## 1. Open the folder

Open this folder in VS Code:

`/Users/keipi/Documents/MAPBOX`

You should see these files:

- `index.html`
- `style.css`
- `script.js`
- `EST_OF_BRITISH_ArcGIS_Ready.csv`

## 2. Add your Mapbox token

1. Open `script.js`.
2. Find this line at the very top:

```js
const MAPBOX_ACCESS_TOKEN = "PASTE_YOUR_MAPBOX_ACCESS_TOKEN_HERE";
```

3. Replace only `PASTE_YOUR_MAPBOX_ACCESS_TOKEN_HERE` with your Mapbox access token.
4. Keep the quotation marks.

Example:

```js
const MAPBOX_ACCESS_TOKEN = "pk.your_real_token_here";
```

## 3. Start the map

The easiest way in VS Code:

1. Install the extension called `Live Server`.
2. Right-click `index.html`.
3. Click `Open with Live Server`.

Another way:

1. Open the VS Code terminal.
2. Type this:

```bash
python3 -m http.server 5500
```

3. Open this address in your browser:

`http://localhost:5500`

## 4. Use the slider

- Move the slider to change the year.
- `Up to` keeps older points visible as you move forward.
- `Active` shows only events happening in that selected year.
- Click any point or event name to see details.

## 5. Add more points later

Add new rows to `EST_OF_BRITISH_ArcGIS_Ready.csv`.

Keep these column names:

- `Year`
- `War_Name`
- `Category`
- `Treaty_Event`
- `People_Involved`
- `Latitude`
- `Longitude`
- `Description`

For year ranges, use examples like `1746-48` or `1802-1805`.

For coordinates, normal decimal numbers are best:

```csv
12.4208,76.6915
```

## 6. Add a new column later

The first line of the CSV is the column heading line. To add a new column:

1. Add the new column name at the end of the first line.
2. Add one extra comma value at the end of every row.
3. If the value has commas inside it, wrap it in quotation marks.

Example:

```csv
Year,War_Name,Category,Treaty_Event,People_Involved,Latitude,Longitude,Description,Source
1773,REGULATING ACT,Administrative Act,Regulating Act of 1773,Warren Hastings,22.5726,88.3639,Created Governor-General of Bengal,Class board photo
```

If you want the new column to appear in the map popup, tell me the column name and I can connect it in `script.js`.
