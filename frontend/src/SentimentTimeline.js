import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

// --- UPDATED: A custom component for our tooltip with correct color logic ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const formattedLabel = new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Determine the color for the sentiment score based on its value
        const sentimentColor = data.average_sentiment > 0.05 ? '#28a745' : data.average_sentiment < -0.05 ? '#dc3545' : '#fff';

        return (
            <div style={{
                backgroundColor: 'rgba(30, 30, 30, 0.9)',
                border: '1px solid #555',
                borderRadius: '8px',
                padding: '10px',
                color: 'white',
                fontSize: '12px'
            }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{formattedLabel}</p>
                {/* Use the dynamic sentimentColor for the text */}
                <p style={{ margin: '5px 0 0 0', color: sentimentColor }}>{`Avg. Sentiment: ${data.average_sentiment.toFixed(2)}`}</p>
                <p style={{ margin: '5px 0 0 0', color: '#aaa' }}>{`Articles: ${data.article_count}`}</p>
            </div>
        );
    }
    return null;
};


export default function SentimentTimeline({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ textAlign: 'center', color: '#888', paddingTop: '50px' }}>Not enough data to display timeline.</div>;
    }

    return (
        <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
                <BarChart
                    data={data.slice(-15)}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                    <XAxis
                        dataKey="date"
                        tickFormatter={(dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fill: '#666', fontSize: 12 }}
                        interval={0}
                    />
                    <YAxis
                        yAxisId="sentiment"
                        domain={[-1, 1]}
                        tick={{ fill: '#666', fontSize: 12 }}
                    />

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />

                    <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" yAxisId="sentiment" />

                    {/* UPDATED: Add maxBarSize to control the width */}
                    <Bar yAxisId="sentiment" dataKey="average_sentiment" name="Avg. Sentiment" maxBarSize={30}>
                        {data.slice(-15).map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.average_sentiment > 0.05 ? '#28a745' : entry.average_sentiment < -0.05 ? '#dc3545' : '#6c757d'}
                            />
                        ))}
                    </Bar>

                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
