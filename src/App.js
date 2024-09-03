import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ChevronDown, ChevronUp, Upload, BarChart, PlusCircle } from 'lucide-react';

const COLORS = ['#4C51BF', '#38A169', '#D69E2E', '#E53E3E', '#667EEA'];

const ACTIVITY_CATEGORIES = {
  Present: ['Explanatory text', 'Information box', 'Reading', 'Video player', 'Reveal', 'Text reveal', 'Audio', 'Interactive video', 'Image swap', 'Podcast', 'Video'],
  Practice: ['Question', 'Formative quiz', 'Quick answer check', 'Multi quick answer check', 'Ordering', 'Interactive table', 'Drag and Drop', 'Image drag and drop', 'Drag and drop table', 'Gap fill', 'Poll', 'Quiz', 'Simulation'],
  Produce: ['File upload', 'Summative quiz', 'Participation grade', 'Journal', 'Video Submission', 'Assignment', 'Sticky note', 'Whiteboard', 'Image tile', 'Coursework'],
  Participate: ['Live class', 'Geotagging', 'Sticky note', 'Whiteboard', 'Image tile', 'Bubblecloud', 'Wordcloud', 'Forum', 'Live Tutorial', 'Poll']
};

const SHARED_ACTIVITIES = ['Sticky note', 'Whiteboard', 'Image tile', 'Poll'];

const ActivityAnalysisTool = () => {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [openAccordions, setOpenAccordions] = useState({});
  const [log, setLog] = useState('');
  const [videoCount, setVideoCount] = useState(''); 

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setError('');
    setResults(null);
  };

  const handleAnalyze = () => {
    if (!file) {
      setError('Please select a file to analyze.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsedData = parseCSV(content);
        const analyzedData = analyzeData(parsedData);
        setResults(analyzedData);
        setError('');
      } catch (err) {
        setError('Error processing input: ' + err.message);
        setResults(null);
      }
    };
    reader.onerror = (e) => {
      setError('Error reading file: ' + e.target.error);
    };
    reader.readAsText(file);
  };

  const parseCSV = (content) => {
    const rows = [];
    let inQuotes = false;
    let currentField = '';
    let currentRow = [];
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if ((char === ',' || char === '\n' || char === '\r') && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
        if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          rows.push(currentRow);
          currentRow = [];
          if (char === '\r' && nextChar === '\n') i++;
        }
      } else {
        currentField += char;
      }
    }
    
    if (currentField) {
      currentRow.push(currentField.trim());
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const activityTitleIndex = headers.findIndex(h => h === 'activity_title');
    
    if (activityTitleIndex === -1) {
      throw new Error('activity_title column not found');
    }

    return rows.slice(1).map(row => {
      const activity = row[activityTitleIndex];
      return activity ? activity.replace(/^"|"$/g, '').replace(/&/g, 'and').trim() : null;
    }).filter(Boolean);
  };

  const analyzeData = (activityTitles) => {
    const categoryCounts = {
      Present: 0,
      Practice: 0,
      Produce: 0,
      Participate: 0,
      Other: 0
    };

    const activityCounts = {};
    const categorizedActivities = {
      Present: {},
      Practice: {},
      Produce: {},
      Participate: {},
      Other: {}
    };

    let logMessage = '';

    activityTitles.forEach((title, index) => {
      if (title.toLowerCase().includes('learning outcomes')) {
        logMessage += `Row ${index + 2}: "${title}" ignored (Learning outcomes)\n`;
        return; // Skip to the next iteration
      }
      let categorized = false;
      let matchedCategory = null;
      let matchedActivity = null;
      let maxMatchLength = 0;
  
      for (const [category, activities] of Object.entries(ACTIVITY_CATEGORIES)) {
        for (const activity of activities) {
          if (title.toLowerCase() === activity.toLowerCase()) {
            // Exact match, use this immediately
            matchedCategory = category;
            matchedActivity = activity;
            break;
          } else if (title.toLowerCase().includes(activity.toLowerCase())) {
            // Partial match, check if it's the longest match so far
            if (activity.length > maxMatchLength) {
              maxMatchLength = activity.length;
              matchedCategory = category;
              matchedActivity = activity;
            }
          }
        }
        if (matchedCategory && matchedActivity && title.toLowerCase() === matchedActivity.toLowerCase()) {
          break;  // Stop searching if we found an exact match
        }
      }
  
      if (matchedCategory && matchedActivity) {
        categoryCounts[matchedCategory]++;
        activityCounts[matchedActivity] = (activityCounts[matchedActivity] || 0) + 1;
        categorizedActivities[matchedCategory][matchedActivity] = (categorizedActivities[matchedCategory][matchedActivity] || 0) + 1;
        categorized = true;
        logMessage += `Row ${index + 2}: "${title}" categorized as ${matchedCategory} (${matchedActivity})\n`;
        
        // Add shared activities to Participate category as well
        if (SHARED_ACTIVITIES.some(activity => matchedActivity.toLowerCase().includes(activity.toLowerCase()))) {
          categoryCounts.Participate++;
          categorizedActivities.Participate[matchedActivity] = (categorizedActivities.Participate[matchedActivity] || 0) + 1;
        }
      } else if (title.toLowerCase().includes('coursework')) {
        // Handle 'coursework' case
        categoryCounts.Produce++;
        activityCounts[title] = (activityCounts[title] || 0) + 1;
        categorizedActivities.Produce[title] = (categorizedActivities.Produce[title] || 0) + 1;
        categorized = true;
        logMessage += `Row ${index + 2}: "${title}" categorized as Produce (Custom Rule - Coursework)\n`;
      } else if (title.toLowerCase().includes('simulation')) {
        // Handle 'simulation' case
        categoryCounts.Practice++;
        activityCounts[title] = (activityCounts[title] || 0) + 1;
        categorizedActivities.Practice[title] = (categorizedActivities.Practice[title] || 0) + 1;
        categorized = true;
        logMessage += `Row ${index + 2}: "${title}" categorized as Practice (Custom Rule - Simulation)\n`;
      }
      // END OF NEW SECTION
  
      if (!categorized) {
        categoryCounts.Other++;
        activityCounts[title] = (activityCounts[title] || 0) + 1;
        categorizedActivities.Other[title] = (categorizedActivities.Other[title] || 0) + 1;
        logMessage += `Row ${index + 2}: "${title}" categorized as Other\n`;
      }
    });
  
    setLog(logMessage);
  
    const totalActivities = activityTitles.length;
  

    // Log category counts before pie chart calculation
    logMessage += `\nBefore pie chart calculation:\n`;
    logMessage += `Produce count: ${categoryCounts.Produce}\n`;
    logMessage += `Participate count: ${categoryCounts.Participate}\n`;

    // Calculate percentages for pie chart
    const pollCount = categorizedActivities.Practice['Poll'] || 0;
    const stickyNoteCount = categorizedActivities.Produce['Sticky note'] || 0;
    const whiteboardCount = categorizedActivities.Produce['Whiteboard'] || 0;
    const imageTileCount = categorizedActivities.Produce['Image tile'] || 0;

    const pieData = [
      {
        name: 'Present',
        value: Math.round((categoryCounts.Present / totalActivities) * 1000) / 10
      },
      {
        name: 'Practice',
        value: Math.round(((categoryCounts.Practice - pollCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Produce',
        value: Math.round(((categoryCounts.Produce - stickyNoteCount / 2 - whiteboardCount / 2 - imageTileCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Participate',
        value: Math.round(((categoryCounts.Participate - stickyNoteCount / 2 - whiteboardCount / 2 - imageTileCount / 2 - pollCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Other',
        value: Math.round((categoryCounts.Other / totalActivities) * 1000) / 10
      }
    ];

    setLog(logMessage);

    return { categoryCounts, activityCounts, pieData, categorizedActivities, totalActivities };
  };

  const handleAddVideos = () => {
    if (!results || isNaN(parseInt(videoCount))) return;
  
    const updatedResults = { ...results };
    const videoCountInt = parseInt(videoCount);
  
    updatedResults.categoryCounts.Present += videoCountInt;
    updatedResults.categorizedActivities.Present['Video'] = (updatedResults.categorizedActivities.Present['Video'] || 0) + videoCountInt;
    updatedResults.totalActivities += videoCountInt;
  
    // Recalculate pie chart data
    const totalActivities = updatedResults.totalActivities;
    const pollCount = updatedResults.categorizedActivities.Practice['Poll'] || 0;
    const stickyNoteCount = updatedResults.categorizedActivities.Produce['Sticky note'] || 0;
    const whiteboardCount = updatedResults.categorizedActivities.Produce['Whiteboard'] || 0;
    const imageTileCount = updatedResults.categorizedActivities.Produce['Image tile'] || 0;
  
    updatedResults.pieData = [
      {
        name: 'Present',
        value: Math.round((updatedResults.categoryCounts.Present / totalActivities) * 1000) / 10
      },
      {
        name: 'Practice',
        value: Math.round(((updatedResults.categoryCounts.Practice - pollCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Produce',
        value: Math.round(((updatedResults.categoryCounts.Produce - stickyNoteCount / 2 - whiteboardCount / 2 - imageTileCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Participate',
        value: Math.round(((updatedResults.categoryCounts.Participate - stickyNoteCount / 2 - whiteboardCount / 2 - imageTileCount / 2 - pollCount / 2) / totalActivities) * 1000) / 10
      },
      {
        name: 'Other',
        value: Math.round((updatedResults.categoryCounts.Other / totalActivities) * 1000) / 10
      }
    ];
  
    setResults(updatedResults);
    setVideoCount('');
  };
  const toggleAccordion = (category) => {
    setOpenAccordions(prev => ({...prev, [category]: !prev[category]}));
  };

  const renderAccordion = (category, activities) => {
    const isOpen = openAccordions[category];
    const count = Object.values(activities).reduce((sum, count) => sum + count, 0);
    return (
      <div key={category} className="mb-4 border rounded-lg overflow-hidden">
        <button
          className="w-full text-left p-4 flex justify-between items-center bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
          onClick={() => toggleAccordion(category)}
        >
          <span className="font-semibold text-lg text-indigo-700">{category} ({count})</span>
          {isOpen ? <ChevronUp size={24} className="text-indigo-600" /> : <ChevronDown size={24} className="text-indigo-600" />}
        </button>
        {isOpen && (
          <ul className="p-4 bg-white">
            {Object.entries(activities).map(([activity, count]) => (
              <li key={activity} className="py-2 border-b last:border-b-0">
                <span className="font-medium">{activity}:</span> <span className="text-indigo-600 font-bold">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-6 text-indigo-700">Analysis Results</h2>
        <p className="mb-6 text-xl font-semibold text-gray-700">Total number of activities: <span className="text-indigo-600">{results.totalActivities}</span></p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 lg:order-2">
            <h3 className="text-2xl font-semibold mb-4 text-indigo-600">Pie Chart</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={results.pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                  label={({ name, value }) => `${name} ${value}%`}
                >
                  {results.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-1 lg:order-1">
            <h4 className="text-2xl font-semibold mt-8 mb-4 text-indigo-600">Activity Breakdown</h4>
            <div className="mb-4 flex items-center">
              <input
                type="number"
                value={videoCount}
                onChange={(e) => setVideoCount(e.target.value)}
                placeholder="Number of videos"
                className="border rounded-l px-3 py-2 w-80"
              />
              <button
                onClick={handleAddVideos}
                className="bg-indigo-600 text-white px-4 py-2 rounded-r hover:bg-indigo-700 transition-colors duration-200"
              >
                <PlusCircle size={20} />
              </button>
            </div>
            {Object.entries(results.categorizedActivities).map(([category, activities]) =>
              renderAccordion(category, activities)
            )}
          </div>
        </div>
        <div className="mt-8">
          <h3 className="text-2xl font-semibold mb-4 text-indigo-600">Analysis Log</h3>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-sm shadow-inner">{log}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 shadow-xl rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-indigo-700 text-center">Activity Analysis Tool</h1>
      <div className="mb-8 bg-white p-6 rounded-lg shadow-lg">
        <label htmlFor="file-upload" className="block text-xl font-medium text-indigo-700 mb-4">
          Upload CSV File
        </label>
        <div className="flex items-center">
          <label htmlFor="file-upload" className="cursor-pointer bg-indigo-600 py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300 ease-in-out">
            <Upload className="h-6 w-6 inline-block mr-2" />
            Choose file
          </label>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleFileChange}
          />
          <span className="ml-4 text-lg text-gray-600">{file ? file.name : 'No file chosen'}</span>
        </div>
      </div>
      <button
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105 mb-8 flex items-center justify-center text-xl"
        onClick={handleAnalyze}
      >
        <BarChart className="mr-3 h-6 w-6" />
        Analyze
      </button>
      {error && <p className="text-red-500 mt-4 text-center text-lg">{error}</p>}
      {renderResults()}
    </div>
  );
};

export default ActivityAnalysisTool;
