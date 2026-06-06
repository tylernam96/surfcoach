"""
claude_client.py — Calls the Anthropic API to turn structured analysis
into a natural-language surf coaching critique.
"""
import os
"""import anthropic"""
import json

"""client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))"""

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
    # Stub — replace with real Claude call when API key is ready
    return {
        "overall": "Test mode — Claude critique disabled.",
        "positives": ["Good effort"],
        "tips": [
            {
                "priority": 1,
                "title": "Test tip",
                "detail": "This is a placeholder while Claude is disabled."
            }
        ],
        "one_thing": "Test mode active."
    }