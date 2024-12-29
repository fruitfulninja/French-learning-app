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
    <div className="overflow-x-auto mb-4">
      <div className="text-sm text-gray-600 mb-2">Distribution of search results:</div>
      <table className="w-full border-collapse border">
        <thead>
          <tr>
            <th className="border p-2 bg-gray-50">Type/Level</th>
            {levels.map(level => (
              <th key={level} className="border p-2 bg-gray-50">{level}</th>
            ))}
            <th className="border p-2 bg-gray-50">Total</th>
          </tr>
        </thead>
        <tbody>
          {types.map(type => (
            <tr key={type}>
              <th className="border p-2 bg-gray-50">{type}</th>
              {levels.map(level => (
                <td
                  key={`${type}-${level}`}
                  onClick={() => onCellClick(type, level)}
                  className={`border p-2 text-center cursor-pointer ${
                    activeType === type && activeLevel === level 
                      ? 'bg-blue-100' 
                      : matrix[type][level] > 0 ? 'hover:bg-gray-50' : 'bg-gray-50'
                  }`}
                >
                  {matrix[type][level]}
                </td>
              ))}
              <td className="border p-2 text-center bg-gray-50 font-medium">
                {rowTotals[type]}
              </td>
            </tr>
          ))}
          <tr>
            <th className="border p-2 bg-gray-50">Total</th>
            {levels.map(level => (
              <td key={level} className="border p-2 text-center bg-gray-50 font-medium">
                {colTotals[level]}
              </td>
            ))}
            <td className="border p-2 text-center bg-gray-100 font-medium">
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
  }, [debouncedSearch, typeFilter, levelFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/Question Bank.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const allData = [];

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
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
              item.level = 'B1';
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

      setData(allData);
      setFilteredData(allData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
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
    return <div className="p-4 text-center text-gray-600">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="p-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search in French..."
        className="w-full p-2 border rounded mb-4"
      />

      {/* Stats Table - Show when searching */}
      {debouncedSearch && (
        <>
          <StatsTable
            data={filteredData}
            onCellClick={(type, level) => {
              setTypeFilter(typeFilter === type && levelFilter === level ? null : type);
              setLevelFilter(levelFilter === level && typeFilter === type ? null : level);
            }}
            activeType={typeFilter}
            activeLevel={levelFilter}
          />
          <div className="text-sm text-gray-600 mb-4">
            Showing {filteredData.length} of {data.length} questions
          </div>
        </>
      )}

      {/* Results */}
      <div className="space-y-4">
        {filteredData.map(item => (
          <div key={item.id} className="p-4 border rounded">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-gray-500">
                <span className="font-medium">{item.type}</span>
                {item.level && <span> - Level {item.level}</span>}
                {item.testNum && <span> - Test {item.testNum}</span>}
                {item.questionNum && <span> - {item.questionNum}</span>}
              </div>
            </div>
            <div className="whitespace-pre-wrap">
              {debouncedSearch ? highlightText(item.content, debouncedSearch) : item.content}
            </div>
            {item.choices && (
              <div className="whitespace-pre-wrap mt-2 text-gray-700">
                {debouncedSearch ? highlightText(item.choices, debouncedSearch) : item.choices}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;