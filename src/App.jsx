import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Fix French character encoding issues
const fixEncoding = (text) => {
  if (!text) return '';
  return text
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã®/g, 'î')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã¹/g, 'ù')
    .replace(/Ã»/g, 'û')
    .replace(/Ã«/g, 'ë')
    .replace(/Ã¯/g, 'ï')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã§/g, 'ç')
    .replace(/Å"/g, 'œ')
    .replace(/Ã¦/g, 'æ');
};

// Normalize text for search (remove accents and special characters)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// Get variations of French words (especially for verbs)
const getWordVariations = (word) => {
  const normalized = normalizeText(word);
  const variations = new Set([normalized]);
  
  if (normalized.endsWith('er')) {
    const stem = normalized.slice(0, -2);
    variations.add(stem + 'e');
    variations.add(stem + 'es');
    variations.add(stem + 'ent');
    variations.add(stem + 'é');
    variations.add(stem + 'ée');
    variations.add(stem + 'és');
    variations.add(stem + 'ées');
  }

  return Array.from(variations);
};

// Cross-tabulation statistics table component
const StatsTable = ({ data, onCellClick, activeType, activeLevel }) => {
  const types = ['CE', 'CO', 'EE', 'EO'];
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  
  const matrix = {};
  const rowTotals = {};
  const colTotals = {};
  let total = 0;

  types.forEach(type => {
    matrix[type] = {};
    levels.forEach(level => {
      matrix[type][level] = 0;
    });
    rowTotals[type] = 0;
  });
  levels.forEach(level => colTotals[level] = 0);

  data.forEach(item => {
    if (matrix[item.type] && matrix[item.type][item.level] !== undefined) {
      matrix[item.type][item.level]++;
      rowTotals[item.type]++;
      colTotals[item.level]++;
      total++;
    }
  });

  if (total === 0) return null;

  return (
    <div className="overflow-x-auto mb-6">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Type/Level</th>
            {levels.map(level => (
              <th key={level}>{level}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {types.map(type => (
            <tr key={type}>
              <th>{type}</th>
              {levels.map(level => (
                <td
                  key={`${type}-${level}`}
                  onClick={() => onCellClick(type, level)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: activeType === type && activeLevel === level 
                      ? '#dbeafe'
                      : matrix[type][level] > 0 ? '#ffffff' : '#f8fafc'
                  }}
                >
                  {matrix[type][level]}
                </td>
              ))}
              <td className="font-medium">
                {rowTotals[type]}
              </td>
            </tr>
          ))}
          <tr>
            <th>Total</th>
            {levels.map(level => (
              <td key={level} className="font-medium">
                {colTotals[level]}
              </td>
            ))}
            <td className="font-medium bg-gray-50">
              {total}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Main app component
const App = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [levelFilter, setLevelFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Filter data when search or filters change
  useEffect(() => {
    filterData();
  }, [debouncedSearch, typeFilter, levelFilter, data]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Starting to load data...');
      
      const response = await fetch('/Question Bank.xlsx');
      if (!response.ok) {
        console.error('Failed to fetch Excel file:', response.status, response.statusText);
        throw new Error('Failed to fetch Excel file');
      }
      
      console.log('Excel file fetched successfully');
      const arrayBuffer = await response.arrayBuffer();
      console.log('Converting to array buffer...');
      
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      console.log('Workbook loaded, sheets:', workbook.SheetNames);
      
      const allData = [];

      workbook.SheetNames.forEach(sheetName => {
        console.log(`Processing sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Found ${rows.length} rows in ${sheetName}`);
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row?.length) continue;

          const item = {
            id: `${sheetName}-${i}`,
            type: sheetName,
          };

          switch (sheetName) {
            case 'CE':
              item.content = fixEncoding(String(row[2] || ''));
              item.choices = fixEncoding(String(row[3] || ''));
              item.level = String(row[4] || 'B1');
              item.testNum = String(row[0] || '').split('_')[1]?.replace('.docx', '') || '';
              item.questionNum = String(row[1] || '');
              break;
            case 'CO':
              item.content = fixEncoding(String(row[7] || ''));
              item.level = String(row[5] || 'B1');
              item.testNum = String(row[1] || '');
              item.questionNum = String(row[3] || '');
              break;
            case 'EE':
              item.content = fixEncoding(String(row[6] || ''));
              item.level = 'B2';
              item.testNum = `${row[1] || ''}-${row[2] || ''}`;
              item.questionNum = String(row[5] || '');
              break;
            case 'EO':
              item.content = fixEncoding(String(row[5] || ''));
              item.level = 'B2';
              item.testNum = String(row[1] || '');
              item.questionNum = String(row[2] || '');
              break;
          }

          if (item.content) {
            item.normalizedContent = normalizeText(item.content + ' ' + (item.choices || ''));
            allData.push(item);
          }
        }
      });

      console.log(`Total items loaded: ${allData.length}`);
      setData(allData);
      setFilteredData(allData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data: ' + err.message);
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = data;

    if (debouncedSearch) {
      const searchTerms = debouncedSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const variations = searchTerms.flatMap(getWordVariations);
      filtered = filtered.filter(item => 
        variations.some(v => item.normalizedContent.includes(v))
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    if (levelFilter) {
      filtered = filtered.filter(item => item.level === levelFilter);
    }

    setFilteredData(filtered);
  };

  const highlightText = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const variations = searchTerm.toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .flatMap(getWordVariations);
    
    const pattern = variations
      .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
    
    return parts.map((part, i) => {
      if (variations.includes(normalizeText(part))) {
        return <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>;
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="card-container">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">French Learning Questions</h1>
      
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search in French..."
        className="search-input"
      />

      {/* Stats Table - Show when searching */}
      {debouncedSearch && (
        <div className="mb-8">
          <StatsTable
            data={filteredData}
            onCellClick={(type, level) => {
              setTypeFilter(typeFilter === type && levelFilter === level ? null : type);
              setLevelFilter(levelFilter === level && typeFilter === type ? null : level);
            }}
            activeType={typeFilter}
            activeLevel={levelFilter}
          />
          <div className="text-lg text-gray-600">
            Showing {filteredData.length} of {data.length} questions
          </div>
        </div>
      )}

      {/* Active Filters */}
      {(typeFilter || levelFilter) && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-gray-600">Active filters:</span>
          {typeFilter && (
            <span 
              className="badge badge-type cursor-pointer"
              onClick={() => setTypeFilter(null)}
            >
              {typeFilter} ×
            </span>
          )}
          {levelFilter && (
            <span 
              className="badge badge-level cursor-pointer"
              onClick={() => setLevelFilter(null)}
            >
              Level {levelFilter} ×
            </span>
          )}
        </div>
      )}

      {/* Results */}
      <div className="space-y-6">
        {filteredData.map(item => (
          <div key={item.id} className="question-card">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="badge badge-type">{item.type}</span>
              {item.level && (
                <span className="badge badge-level">Level {item.level}</span>
              )}
              {item.testNum && (
                <span className="badge badge-test">Test {item.testNum}</span>
              )}
              {item.questionNum && (
                <span className="badge badge-test">Question {item.questionNum}</span>
              )}
            </div>
            
            <div className="mt-4 text-lg leading-relaxed">
              <div className="text-gray-800 whitespace-pre-wrap">
                {debouncedSearch ? highlightText(item.content, debouncedSearch) : item.content}
              </div>
              {item.choices && (
                <div className="mt-4 text-gray-700 whitespace-pre-wrap border-t pt-4">
                  {debouncedSearch ? highlightText(item.choices, debouncedSearch) : item.choices}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
