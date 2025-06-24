import React, { useState, useEffect } from 'react';
import { Plus, Vote, TrendingUp, Users, BarChart3, CheckCircle } from 'lucide-react';

const VotingApp = () => {
  const [polls, setPolls] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: [{ voteOption: '', voteCount: 0 }, { voteOption: '', voteCount: 0 }]
  });
  const [votedPolls, setVotedPolls] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // API configuration - Remove trailing slash
  const API_BASE = 'http://localhost:8080/api/polls';

  // API utility functions with error handling and retry logic
  const apiCall = async (url, options = {}, retries = 3) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      mode: 'cors', // Enable CORS
      ...options
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`Making API call to: ${url}`, config); // Debug log
        const response = await fetch(url, config);
        
        console.log(`Response status: ${response.status}`); // Debug log
        
        if (!response.ok) {
          if (response.status >= 500 && attempt < retries) {
            // Retry on server errors
            console.log(`Server error, retrying... (${attempt + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        // Handle empty responses (like for vote endpoint)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log('API response data:', data); // Debug log
          return data;
        } else {
          console.log('Empty or non-JSON response'); // Debug log
          return null;
        }
      } catch (error) {
        console.error(`API call attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) {
          console.error('API call failed after all retries:', error);
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  };

  // Fetch all polls from backend
  const fetchPolls = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall(API_BASE);
      setPolls(data || []);
      setRetryCount(0);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setError('Failed to load polls. Please check your connection and try again.');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch a specific poll by ID
  const fetchPollById = async (pollId) => {
    try {
      const data = await apiCall(`${API_BASE}/${pollId}`);
      return data;
    } catch (error) {
      console.error('Error fetching poll:', error);
      setError(`Failed to fetch poll details for poll ${pollId}`);
      throw error;
    }
  };

  // Create a new poll
  const createPoll = async () => {
    if (!newPoll.question.trim()) {
      setError('Poll question is required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const validOptions = newPoll.options.filter(opt => opt.voteOption.trim());
    if (validOptions.length < 2) {
      setError('At least 2 options are required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const pollData = {
        question: newPoll.question.trim(),
        options: validOptions.map(opt => ({
          voteOption: opt.voteOption.trim(),
          voteCount: 0
        }))
      };

      const createdPoll = await apiCall(API_BASE, {
        method: 'POST',
        body: JSON.stringify(pollData)
      });

      // Add the new poll to the local state
      setPolls([createdPoll, ...polls]);
      
      // Reset form
      setNewPoll({
        question: '',
        options: [{ voteOption: '', voteCount: 0 }, { voteOption: '', voteCount: 0 }]
      });
      setShowCreateForm(false);
      setNotification('Poll created successfully!');
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Error creating poll:', error);
      setError('Failed to create poll. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Submit a vote
  const vote = async (pollId, optionIndex) => {
    try {
      const voteData = {
        pollId: pollId,
        optionIndex: optionIndex
      };

      await apiCall(`${API_BASE}/vote`, {
        method: 'POST',
        body: JSON.stringify(voteData)
      });

      // After successful vote, fetch the updated poll data
      try {
        const updatedPoll = await fetchPollById(pollId);
        
        // Update the polls array with the new vote counts
        const updatedPolls = polls.map(poll => 
          poll.id === pollId ? updatedPoll : poll
        );
        setPolls(updatedPolls);
      } catch (fetchError) {
        // If we can't fetch updated data, optimistically update the UI
        const updatedPolls = polls.map(poll => {
          if (poll.id === pollId) {
            const updatedOptions = [...poll.options];
            updatedOptions[optionIndex].voteCount += 1;
            return { ...poll, options: updatedOptions };
          }
          return poll;
        });
        setPolls(updatedPolls);
      }
      
      // Mark this poll as voted
      setVotedPolls(new Set([...votedPolls, pollId]));
      setNotification('Vote submitted successfully!');
      setTimeout(() => setNotification(''), 3000);
    } catch (error) {
      console.error('Error voting:', error);
      setError('Failed to submit vote. Please try again.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Refresh polls data
  const refreshPolls = async () => {
    await fetchPolls();
  };

  const addOption = () => {
    setNewPoll({
      ...newPoll,
      options: [...newPoll.options, { voteOption: '', voteCount: 0 }]
    });
  };

  const removeOption = (index) => {
    if (newPoll.options.length > 2) {
      const updatedOptions = newPoll.options.filter((_, i) => i !== index);
      setNewPoll({ ...newPoll, options: updatedOptions });
    }
  };

  const updateOption = (index, value) => {
    const updatedOptions = [...newPoll.options];
    updatedOptions[index].voteOption = value;
    setNewPoll({ ...newPoll, options: updatedOptions });
  };

  const getTotalVotes = (poll) => {
    return poll.options.reduce((total, option) => total + option.voteCount, 0);
  };

  const getVotePercentage = (option, total) => {
    return total > 0 ? ((option.voteCount / total) * 100).toFixed(1) : 0;
  };

  useEffect(() => {
    fetchPolls();
    
    // Check connection status
    const checkConnection = async () => {
      try {
        // Use a simple GET request instead of HEAD for connection check
        await fetch(`${API_BASE}`, { 
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json'
          }
        });
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Connection check failed:', error);
        setConnectionStatus('disconnected');
      }
    };
    
    checkConnection();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('checking');
      checkConnection();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-8 -left-4 w-72 h-72 bg-cyan-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 animate-fade-in">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              VoteSphere
            </span>
          </h1>
          <p className="text-xl text-gray-300 animate-fade-in-delay">
            Create polls, gather opinions, make decisions together
          </p>
          
          {/* Connection Status */}
          {connectionStatus !== 'connected' && (
            <div className={`mt-4 inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              connectionStatus === 'offline' 
                ? 'bg-red-500 text-white' 
                : connectionStatus === 'disconnected'
                ? 'bg-yellow-500 text-white'
                : 'bg-blue-500 text-white'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                connectionStatus === 'offline' 
                  ? 'bg-red-300' 
                  : connectionStatus === 'disconnected'
                  ? 'bg-yellow-300 animate-pulse'
                  : 'bg-blue-300 animate-pulse'
              }`}></div>
              {connectionStatus === 'offline' && 'You are offline'}
              {connectionStatus === 'disconnected' && 'Server disconnected'}
              {connectionStatus === 'checking' && 'Checking connection...'}
            </div>
          )}
        </div>

        {/* Notification & Error Messages */}
        {notification && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              {notification}
            </div>
          </div>
        )}
        
        {error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button 
                onClick={() => setError('')}
                className="ml-4 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Create Poll Button */}
        <div className="text-center mb-8">
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create New Poll
            </button>
            
            <button
              onClick={refreshPolls}
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white px-6 py-4 rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center disabled:opacity-50"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Create Poll Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform animate-scale-in">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Poll</h2>
              
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">Question</label>
                <input
                  type="text"
                  value={newPoll.question}
                  onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter your poll question..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">Options</label>
                {newPoll.options.map((option, index) => (
                  <div key={index} className="flex items-center mb-3">
                    <input
                      type="text"
                      value={option.voteOption}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder={`Option ${index + 1}`}
                    />
                    {newPoll.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="ml-2 text-red-500 hover:text-red-700 transition-colors duration-200"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="text-purple-500 hover:text-purple-700 font-semibold transition-colors duration-200"
                >
                  + Add Option
                </button>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={createPoll}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                >
                  Create Poll
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="text-white mt-4">Loading polls...</p>
          </div>
        )}

        {/* Polls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {polls.map((poll, index) => {
            const totalVotes = getTotalVotes(poll);
            const hasVoted = votedPolls.has(poll.id);
            
            return (
              <div
                key={poll.id}
                className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-6 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <Vote className="w-6 h-6 text-cyan-400" />
                  <div className="flex items-center text-gray-300">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="text-sm">{totalVotes} votes</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-700 mb-6">{poll.question}</h3>

                <div className="space-y-3">
                  {poll.options.map((option, optionIndex) => {
                    const percentage = getVotePercentage(option, totalVotes);
                    
                    return (
                      <div key={optionIndex} className="relative">
                        <button
                          onClick={() => !hasVoted && vote(poll.id, optionIndex)}
                          disabled={hasVoted}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-300 ${
                            hasVoted
                              ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                              : 'bg-white bg-opacity-10 border-gray-300 hover:border-cyan-400 hover:bg-opacity-20 cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium">{option.voteOption}</span>
                            <span className="text-cyan-400 font-bold">{percentage}%</span>
                          </div>
                          
                          {hasVoted && (
                            <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-1000 ease-out"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          )}
                        </button>
                        
                        {hasVoted && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-green-500 rounded-full p-1">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {hasVoted && (
                  <div className="mt-4 text-center">
                    <div className="flex items-center justify-center text-gray-300">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      <span className="text-sm">Results visible after voting</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {polls.length === 0 && !loading && (
          <div className="text-center py-12">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-300">No polls available yet.</p>
            <p className="text-gray-400">Create your first poll to get started!</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in-delay 0.6s ease-out 0.3s both;
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default VotingApp;