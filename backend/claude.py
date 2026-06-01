"""
claude_client.py — Calls the Anthropic API to turn structured analysis
into a natural-language surf coaching critique.
"""
import os
import anthropic
import json

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are an expert surf coach with 20 years of experience coaching 
surfers from beginner to professional level. You analyse surf footage and give 
clear, actionable, encouraging feedback.

Your critiques are:
- Specific and technical but accessible (explain the why, not just the what)
- Encouraging — always find something positive
- Prioritised — focus on the 1-2 most impactful things to fix first
- Grounded in the data provided — don't invent issues not flagged
- Conversational, like a coach talking to a surfer after a session

You respond only with valid JSON in this exact shape:
{
  "overall": "2-3 sentence overall impression",
  "positives": ["thing they did well", ...],
  "tips": [
    {
      "priority": 1,
      "title": "Short title",
      "detail": "Detailed coaching explanation with the why and a drill or cue to fix it"
    },
    ...
  ],
  "one_thing": "The single most important thing to focus on next session"
}"""


def get_surf_critique(analysis: dict) -> dict:
    """
    Takes the structured analysis dict from analyse.py and returns
    a dict with Claude's natural-language coaching critique.
    """
    flags = analysis.get("flags", [])
    metrics = analysis.get("metrics", {})
    summary = analysis.get("summary", "")

    user_message = f"""Here is the automated analysis of a surfer's video:

SUMMARY:
{summary}

DETAILED METRICS:
{json.dumps(metrics, indent=2)}

FLAGS RAISED ({len(flags)} total):
{json.dumps(flags, indent=2)}

Please provide your coaching critique as a surf coach who has watched this footage.
Focus on the highest-priority issues and give actionable advice."""

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped in expected shape
        return {
            "overall": raw,
            "positives": [],
            "tips": [],
            "one_thing": "",
        }