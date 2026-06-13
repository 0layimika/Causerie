# Causerie Local Setup Guide

This guide is for someone who wants to try Causerie on their own computer, even if they are not technical.

Causerie is currently a local web app. That means it runs in your browser from your computer. It is not deployed online yet.

## What You Need

You need:

- A computer with internet access.
- Google Chrome, Microsoft Edge, or another modern browser.
- Node.js installed on your computer.

You do not need to create any paid account to run this local MVP.

## Step 1: Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org).
2. Download the version marked `LTS`.
3. Install it using the default options.
4. Restart your terminal app if it was already open.

To check that Node.js installed correctly, open your terminal and run:

```bash
node --version
```

If you see a version number, you are good.

## Step 2: Download This Project

Go to the GitHub repo page:

[https://github.com/0layimika/Causerie](https://github.com/0layimika/Causerie)

Then either:

1. Click the green `Code` button.
2. Click `Download ZIP`.
3. Unzip the downloaded file.

Or, if you already know how to use Git, run:

```bash
git clone https://github.com/0layimika/Causerie.git
```

## Step 3: Open the Project Folder in Terminal

Open your terminal and move into the project folder.

If you downloaded the ZIP, the folder may be in your Downloads folder. Example:

```bash
cd Downloads/Causerie-main
```

If you used Git clone, run:

```bash
cd Causerie
```

Tip: On Mac, you can also type `cd `, drag the folder into the terminal window, and press Enter.

## Step 4: Start the App

Run:

```bash
npm start
```

You should see something like:

```text
Causerie running at http://127.0.0.1:4173
```

Leave this terminal window open while using the app.

## Step 5: Open Causerie in Your Browser

Open this link in your browser:

[http://127.0.0.1:4173](http://127.0.0.1:4173)

You should now see the Causerie home screen.

## Using the App

1. Click `Start first rep`.
2. Choose why you are learning French.
3. Choose your current level.
4. Tick the consent checkbox.
5. Click `Begin speaking`.

Inside the conversation screen:

- Use `Mic` if your browser supports voice input.
- Use the text box if voice input is not available.
- Click `I’m stuck` to test the anti-dead-end help.
- Click `End` to see the debrief.

## Microphone Permission

The browser should only ask for microphone permission when you click `Mic`.

If microphone input does not work, use the text box. The MVP is designed to still work with typed input.

For best microphone support, use Chrome or Edge.

## How to Stop the App

Go back to the terminal window where the app is running.

Press:

```text
Control + C
```

The app will stop running locally.

## Troubleshooting

### `npm start` says command not found

Node.js may not be installed correctly. Install Node.js from [https://nodejs.org](https://nodejs.org), then restart your terminal.

### The page does not open

Make sure the terminal still says:

```text
Causerie running at http://127.0.0.1:4173
```

If not, run:

```bash
npm start
```

again from inside the project folder.

### The microphone does not work

Try:

- Use Chrome or Edge.
- Click the browser’s microphone permission icon and allow access.
- Refresh the page.
- Use the text box fallback if it still does not work.

### I want to reset the app

Click `Delete data` in the top right of the app. This clears the local progress saved in your browser.

## What This MVP Does

This MVP demonstrates:

- A mobile-first responsive web app.
- A French conversation loop.
- Anti-dead-end help when the learner freezes.
- A warm post-conversation debrief.
- Local progress and confidence tracking.
- Text fallback when microphone input is unavailable.

It does not yet connect to a real AI speech provider. The current version is a product MVP prototype that runs locally.
