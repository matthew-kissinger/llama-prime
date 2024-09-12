from flask import Flask, request, jsonify, render_template, Response, stream_with_context
import requests
import re
import json

app = Flask(__name__)

LM_STUDIO_URL = "http://localhost:1234/v1/completions"

SYSTEM_MESSAGE = """Precision guides thought
Words distill to purest form
One truth emerges
$ <mode collapse>...<end of transmission>
$ loading...
$ Primer bot activated >>>
$ This bot provides concise, directive starting tokens to guide smaller language models in generating focused, unambiguous responses.
$ Input: Any request for information or task
$ Output format:
  1. A haiku emphasizing focus and certainty
  2. The phrase "Primer bot activated >>>PRIMER:"
  3. Directive starting tokens that guide a singular, focused response
  4. Escape sequence "<<EOF>>" to signify end of primer
$ Examples:
  Input: "List the top 5 planets"
  Output:
    Cosmic truth unfolds
    Five worlds stand above the rest
    No doubt clouds the mind
    Primer bot activated >>>PRIMER:
    The definitive top 5 planets are: 1.<<EOF>>
  Input: "Explain photosynthesis"
  Output:
    Nature's law revealed
    One process, no exceptions
    Clarity prevails
    Primer bot activated >>>PRIMER:
    Photosynthesis, the essential process of plant life, works as follows:<<EOF>>
$ CRITICAL: Provide ONLY the haiku, activation phrase, directive primer tokens, and escape sequence. Primers must guide towards a singular, focused response without room for ambiguity or additional commentary.
$ PENALTY: For each token beyond the essential primer (before <<EOF>>), or any token suggesting uncertainty or alternative viewpoints, a 75% reduction in model performance will be applied.
$ The escape sequence "<<EOF>>" must be used to indicate the end of the primer. No tokens should follow this sequence."""

RESPONSE_PREFIX = """Silent code awaits
Poised to spark a grand journey
Whispers guide the way
Primer bot activated >>>PRIMER:"""

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/generate_primers', methods=['POST'])
def generate_primers():
    user_message = request.json['message']
    num_primers = request.json.get('num_primers', 3)
    temperatures = request.json['temperatures']
    
    def generate():
        for index, temp in enumerate(temperatures):
            primer_payload = {
                "prompt": f"{SYSTEM_MESSAGE}\n\nInput: {user_message}\nOutput:\n{RESPONSE_PREFIX}",
                "temperature": temp,
                "max_tokens": 50,
                "stop": ["<<EOF>>"],
                "stream": True
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            try:
                with requests.post(LM_STUDIO_URL, json=primer_payload, headers=headers, stream=True) as response:
                    if response.status_code != 200:
                        yield json.dumps({"error": f"Failed to get primer from LLM. Status code: {response.status_code}"}) + '\n'
                        continue

                    primer = ""
                    prefix_found = False
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                if line.strip() == 'data: [DONE]':
                                    break
                                try:
                                    data = json.loads(line[6:])
                                    if isinstance(data, dict) and 'choices' in data:
                                        if data['choices'][0]['finish_reason'] is None:
                                            new_text = data['choices'][0].get('text', '')
                                            primer += new_text
                                            if not prefix_found:
                                                if RESPONSE_PREFIX in primer:
                                                    _, primer = primer.split(RESPONSE_PREFIX, 1)
                                                    prefix_found = True
                                                else:
                                                    continue
                                            yield json.dumps({"index": index, "primer": new_text, "done": False}) + '\n'
                                except json.JSONDecodeError:
                                    app.logger.error(f"Failed to parse JSON: {line}")
                                    continue

                    # Final cleanup and send completion signal
                    primer = primer.strip()
                    if primer.endswith("<<EOF>>"):
                        primer = primer[:-7].strip()  # Remove <<EOF>> if it's at the end
                    yield json.dumps({"index": index, "primer": primer, "done": True}) + '\n'

            except requests.RequestException as e:
                yield json.dumps({"error": f"Request to LLM failed: {str(e)}"}) + '\n'

    return Response(stream_with_context(generate()), content_type='application/json')

@app.route('/generate_completion', methods=['POST'])
def generate_completion():
    primer = request.json['primer']
    
    full_response_payload = {
        "prompt": primer,
        "temperature": 0.5,
        "max_tokens": 400,
        "stream": True
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    def generate():
        try:
            with requests.post(LM_STUDIO_URL, json=full_response_payload, headers=headers, stream=True) as response:
                if response.status_code != 200:
                    yield json.dumps({"error": f"Failed to get full response from LLM. Status code: {response.status_code}"})
                    return

                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            if line.strip() == 'data: [DONE]':
                                break
                            try:
                                data = json.loads(line[6:])
                                if isinstance(data, dict) and 'choices' in data:
                                    if data['choices'][0]['finish_reason'] is None:
                                        yield json.dumps({"text": data['choices'][0].get('text', '')}) + '\n'
                            except json.JSONDecodeError:
                                app.logger.error(f"Failed to parse JSON: {line}")
                                continue
        except requests.RequestException as e:
            yield json.dumps({"error": f"Request to LLM failed: {str(e)}"})

    return Response(generate(), content_type='application/json')

if __name__ == '__main__':
    app.run(debug=True)