import json

with open(r'C:\Users\ASUS\.gemini\antigravity-ide\brain\78ab138a-7ea8-46b1-a3d0-a50114641327\.system_generated\steps\385\output.txt') as f:
    data = json.load(f)

gs2 = [p for p in data['projects'] if p['title'] == 'GitScope 2'][0]
theme = gs2['designTheme']

colors = {k.replace('_', '-'): v for k, v in theme['namedColors'].items()}
spacing = theme['spacing']

tw = f'''/** @type {{import('tailwindcss').Config}} */
export default {{
  content: [
    "./index.html",
    "./src/**/*.{{js,ts,jsx,tsx}}",
  ],
  darkMode: "class",
  theme: {{
    extend: {{
      colors: {json.dumps(colors, indent=6)},
      spacing: {json.dumps(spacing, indent=6)},
      fontFamily: {{
        'display-lg': ['Syne', 'sans-serif'],
        'headline-lg': ['Syne', 'sans-serif'],
        'headline-md': ['Syne', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'code-md': ['JetBrains Mono', 'monospace'],
        'label-caps': ['JetBrains Mono', 'monospace'],
      }},
      fontSize: {{
        'display-lg': ['48px', {{ lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }}],
        'headline-lg': ['32px', {{ lineHeight: '1.2', fontWeight: '700' }}],
        'headline-md': ['24px', {{ lineHeight: '1.3', fontWeight: '600' }}],
        'body-lg': ['18px', {{ lineHeight: '1.6', fontWeight: '400' }}],
        'body-md': ['16px', {{ lineHeight: '1.5', fontWeight: '400' }}],
        'code-md': ['14px', {{ lineHeight: '1.5', fontWeight: '400' }}],
        'label-caps': ['12px', {{ lineHeight: '1.2', fontWeight: '600', letterSpacing: '0.1em' }}],
      }}
    }}
  }},
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}}
'''

with open(r'd:\Projects\gitscope\frontend\tailwind.config.js', 'w', encoding='utf-8') as f:
    f.write(tw)
print("tailwind.config.js written")
