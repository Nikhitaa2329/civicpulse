const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const VALID_CATEGORIES = [
  'waterlogging', 'power_outage', 'broken_road', 'garbage',
  'streetlight', 'water_supply', 'open_manhole', 'other'
];

exports.parseComplaint = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ message: 'Please describe the issue in more detail' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `You are helping citizens file formal civic complaints in Tamil Nadu, India.

The user described an issue in casual language. Your job is to:
1. Write a SHORT, FORMAL title (under 80 chars) - NOT the user's words verbatim
2. Identify the BEST matching category
3. Write a FORMAL 1-2 sentence description that a municipal officer would read - rewrite it professionally, do NOT copy the user's casual words

Respond with ONLY valid JSON, no markdown, no other text:
{
  "title": "formal short title",
  "category": "one of: waterlogging, power_outage, broken_road, garbage, streetlight, water_supply, open_manhole, other",
  "description": "formal professional description for municipal records"
}

User's casual description: "${text}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = 'other';
    }

    res.status(200).json(parsed);

  } catch (aiError) {
    console.error('AI parsing error:', aiError);
    res.status(500).json({ message: 'AI assist unavailable', error: aiError.message });
  }
};