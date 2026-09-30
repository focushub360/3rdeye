import fs from 'fs';
const file = 'f:/Projects/3W/3W-WHEELERTVS-FRONTEND/src/components/analytics/FormAnalyticsDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the first occurrence of the table header
content = content.replace('<span>Selected Chassis</span>', '<span>System Chassis</span>');
content = content.replace('title="Selected Chassis"', 'title="System Chassis"');

fs.writeFileSync(file, content);
console.log('Fixed header');
