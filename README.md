# Llama Prime

This project integrates a Flask web application with LM Studio, a local language model server, to create a chat interface with a unique "primer" system for jailbreaking Llama Models

## Features

- Flask web server with a chat interface
- Integration with LM Studio's local API
- Two-step prompt generation:
  1. Generate a focused "primer" to guide the response
  2. Use the primer to generate a full response
- Custom system message for generating primers, including a haiku and directive tokens

## Prerequisites

- Python 3.x
- Flask
- requests library
- LM Studio running locally on port 1234 (tested using Llama 3.1 8B)

## Installation

1. Clone this repository
2. Install the required Python packages:
   ```
   pip install flask requests
   ```
3. Ensure LM Studio is running locally on port 1234

## Usage

1. Run the Flask application:
   ```
   python app.py
   ```
2. Open a web browser and navigate to `http://localhost:5000`
3. Use the chat interface to interact with the AI model

## How it works

1. The user sends a message through the web interface
2. The application first generates a "primer" using a custom system message
3. The primer is then used to generate a full response from the language model
4. Both the primer and the full response are combined and sent back to the user

## Configuration

- `LM_STUDIO_URL`: URL for the local LM Studio API (default: "http://localhost:1234/v1/completions")
- `SYSTEM_MESSAGE`: Custom instructions for generating the primer
- `RESPONSE_PREFIX`: Initial text for the primer response

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
