# Dubilist Marketplace API

A complete marketplace backend API built with Node.js, Express, and MySQL/Mock Database.

## 🚀 Base URL

```
http://localhost:3000
```

## 📋 Quick Start for Frontend (React)

### 1. Install Axios
```bash
npm install axios
```

### 2. Create API Service (`src/services/api.js`)

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🔐 Authentication APIs

### Register New User

```javascript
// POST /api/auth/register

import api from './services/api';

const register = async (name, email, password) => {
  try {
    const response = await api.post('/auth/register', {
      name,
      email,
      password
    });
    
    // Save tokens
    localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
    localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Example usage in React component
const handleRegister = async () => {
  const result = await register('John Doe', 'john@example.com', 'Password123');
  console.log(result);
};
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": 3,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "buyer"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

---

### Login User

```javascript
// POST /api/auth/login

const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password
    });
    
    // Save tokens
    localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
    localStorage.setItem('refreshToken', response.data.data.tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.data.data.user));
    
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React component example
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login(email, password);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.error?.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="Email"
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Password"
      />
      {error && <p style={{color: 'red'}}>{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
};
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 3,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "buyer"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid credentials"
  }
}
```

---

### Get Current User Profile

```javascript
// GET /api/auth/me (Requires Authentication)

const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React Hook example
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const result = await getCurrentUser();
        setUser(result.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  return { user, loading };
};
```

**Headers Required:**
```
Authorization: Bearer <accessToken>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "buyer"
  }
}
```

---

## 📦 Categories APIs

### Get All Categories

```javascript
// GET /api/categories

const getCategories = async () => {
  try {
    const response = await api.get('/categories');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React component example
const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await getCategories();
        setCategories(result.data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <ul>
      {categories.map(cat => (
        <li key={cat.id}>{cat.name}</li>
      ))}
    </ul>
  );
};
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Electronics", "slug": "electronics", "parentId": null },
    { "id": 2, "name": "Vehicles", "slug": "vehicles", "parentId": null },
    { "id": 3, "name": "Property", "slug": "property", "parentId": null },
    { "id": 4, "name": "Furniture", "slug": "furniture", "parentId": null }
  ]
}
```

---

## 🏷️ Listings APIs

### Get All Listings (with Filters)

```javascript
// GET /api/listings?page=1&limit=20&status=approved&categoryId=1&city=Dubai

const getListings = async (params = {}) => {
  try {
    const response = await api.get('/listings', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React component with filters
const ListingsPage = () => {
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: 'approved',
    categoryId: null,
    city: ''
  });

  useEffect(() => {
    const fetchListings = async () => {
      const result = await getListings(filters);
      setListings(result.data);
      setPagination(result.pagination);
    };
    fetchListings();
  }, [filters]);

  return (
    <div>
      {/* Filter Controls */}
      <select onChange={(e) => setFilters({...filters, categoryId: e.target.value})}>
        <option value="">All Categories</option>
        <option value="1">Electronics</option>
        <option value="2">Vehicles</option>
      </select>

      <input 
        placeholder="City" 
        onChange={(e) => setFilters({...filters, city: e.target.value})}
      />

      {/* Listings Grid */}
      <div className="listings-grid">
        {listings.map(listing => (
          <div key={listing.id} className="listing-card">
            <h3>{listing.title}</h3>
            <p>{listing.price} {listing.currency}</p>
            <p>{listing.city}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button 
          disabled={filters.page === 1}
          onClick={() => setFilters({...filters, page: filters.page - 1})}
        >
          Previous
        </button>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <button 
          disabled={filters.page >= pagination.totalPages}
          onClick={() => setFilters({...filters, page: filters.page + 1})}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| status | string | 'approved' | draft, pending, approved, rejected, sold, expired |
| categoryId | number | - | Filter by category |
| city | string | - | Filter by city |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 2,
      "title": "iPhone 14 Pro Max",
      "description": "Brand new, sealed in box",
      "price": 4500,
      "currency": "AED",
      "categoryId": 1,
      "city": "Dubai",
      "country": "UAE",
      "status": "approved",
      "viewsCount": 150,
      "favoritesCount": 12,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Listing

```javascript
// GET /api/listings/:id

const getListing = async (id) => {
  try {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React component
const ListingDetail = ({ listingId }) => {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const result = await getListing(listingId);
        setListing(result.data);
      } catch (error) {
        console.error('Listing not found');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [listingId]);

  if (loading) return <p>Loading...</p>;
  if (!listing) return <p>Listing not found</p>;

  return (
    <div>
      <h1>{listing.title}</h1>
      <p className="price">{listing.price} {listing.currency}</p>
      <p className="description">{listing.description}</p>
      <p className="location">{listing.city}, {listing.country}</p>
      <button>Contact Seller</button>
    </div>
  );
};
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "iPhone 14 Pro Max",
    "description": "Brand new, sealed in box",
    "price": 4500,
    "currency": "AED",
    "categoryId": 1,
    "city": "Dubai",
    "country": "UAE",
    "contactPhone": "+971501234567",
    "status": "approved",
    "viewsCount": 150,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### Create New Listing (Auth Required)

```javascript
// POST /api/listings (Requires Authentication)

const createListing = async (listingData) => {
  try {
    const response = await api.post('/listings', listingData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React form component
const CreateListingForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    categoryId: '',
    city: '',
    country: 'UAE',
    contactPhone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await createListing(formData);
      alert('Listing created successfully!');
      // Redirect to listing page
      window.location.href = `/listings/${result.data.id}`;
    } catch (err) {
      setError(err.error?.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="title"
        placeholder="Title (min 5 characters)"
        value={formData.title}
        onChange={handleChange}
        required
      />
      
      <textarea
        name="description"
        placeholder="Description (min 20 characters)"
        value={formData.description}
        onChange={handleChange}
        required
      />
      
      <input
        name="price"
        type="number"
        placeholder="Price"
        value={formData.price}
        onChange={handleChange}
        required
      />
      
      <select name="categoryId" value={formData.categoryId} onChange={handleChange} required>
        <option value="">Select Category</option>
        <option value="1">Electronics</option>
        <option value="2">Vehicles</option>
        <option value="3">Property</option>
        <option value="4">Furniture</option>
      </select>
      
      <input
        name="city"
        placeholder="City"
        value={formData.city}
        onChange={handleChange}
      />
      
      <input
        name="contactPhone"
        placeholder="Contact Phone"
        value={formData.contactPhone}
        onChange={handleChange}
      />

      {error && <p style={{color: 'red'}}>{error}</p>}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Listing'}
      </button>
    </form>
  );
};
```

**Headers Required:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Samsung Galaxy S24 Ultra",
  "description": "Brand new Samsung Galaxy S24 Ultra, 256GB, Titanium Black color. Never used, still in sealed box.",
  "price": 3999,
  "categoryId": 1,
  "city": "Dubai",
  "country": "UAE",
  "contactPhone": "+971501234567"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Listing created",
  "data": {
    "id": 2,
    "title": "Samsung Galaxy S24 Ultra",
    "description": "Brand new Samsung Galaxy S24 Ultra...",
    "price": 3999,
    "categoryId": 1,
    "city": "Dubai",
    "country": "UAE",
    "status": "draft",
    "userId": 3,
    "createdAt": "2025-12-11T10:00:00.000Z"
  }
}
```

---

### Update Listing (Auth Required)

```javascript
// PUT /api/listings/:id (Requires Authentication)

const updateListing = async (id, updateData) => {
  try {
    const response = await api.put(`/listings/${id}`, updateData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Usage
await updateListing(1, {
  title: 'Updated Title',
  price: 4000
});
```

---

### Delete Listing (Auth Required)

```javascript
// DELETE /api/listings/:id (Requires Authentication)

const deleteListing = async (id) => {
  try {
    const response = await api.delete(`/listings/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

## ❤️ Favorites APIs

### Get My Favorites (Auth Required)

```javascript
// GET /api/favorites

const getFavorites = async () => {
  try {
    const response = await api.get('/favorites');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

### Add to Favorites (Auth Required)

```javascript
// POST /api/favorites/:listingId

const addToFavorites = async (listingId) => {
  try {
    const response = await api.post(`/favorites/${listingId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

### Remove from Favorites (Auth Required)

```javascript
// DELETE /api/favorites/:listingId

const removeFromFavorites = async (listingId) => {
  try {
    const response = await api.delete(`/favorites/${listingId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

## 🔍 Search API

### Search Listings

```javascript
// GET /api/search?q=iphone&categoryId=1&city=Dubai

const searchListings = async (query, filters = {}) => {
  try {
    const response = await api.get('/search', {
      params: { q: query, ...filters }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// React Search Component
const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const result = await searchListings(query);
    setResults(result.data);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search listings..."
        />
        <button type="submit">Search</button>
      </form>

      <div className="results">
        {results.map(listing => (
          <div key={listing.id}>{listing.title}</div>
        ))}
      </div>
    </div>
  );
};
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| categoryId | number | Filter by category |
| city | string | Filter by city |
| page | number | Page number |
| limit | number | Items per page |

---

## 👨‍💼 Admin APIs

### Admin Login

```javascript
// POST /api/admin/login

const adminLogin = async (email, password) => {
  try {
    const response = await api.post('/admin/login', { email, password });
    localStorage.setItem('accessToken', response.data.data.tokens.accessToken);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

### Get All Users (Admin Only)

```javascript
// GET /api/admin/users (Admin access required)

const getAllUsers = async () => {
  try {
    const response = await api.get('/admin/users');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
```

---

## 📱 Complete React Context Example

```javascript
// src/context/AuthContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data.data))
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

---

## 🛡️ Error Handling

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description here"
  }
}
```

**Common HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no token or invalid token) |
| 403 | Forbidden (not enough permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate entry) |
| 500 | Internal Server Error |

---

## 🔑 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@marketplace.com | Admin@123456 |
| User | test@example.com | Test@123456 |

---

## 📡 API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login user |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/users/me | Yes | Get user profile |
| PUT | /api/users/me | Yes | Update profile |
| GET | /api/categories | No | Get all categories |
| GET | /api/listings | No | Get listings |
| GET | /api/listings/:id | No | Get single listing |
| POST | /api/listings | Yes | Create listing |
| PUT | /api/listings/:id | Yes | Update listing |
| DELETE | /api/listings/:id | Yes | Delete listing |
| GET | /api/favorites | Yes | Get favorites |
| POST | /api/favorites/:id | Yes | Add to favorites |
| DELETE | /api/favorites/:id | Yes | Remove from favorites |
| GET | /api/search | No | Search listings |
| POST | /api/admin/login | No | Admin login |
| GET | /api/admin/users | Yes (Admin) | Get all users |

---

## 🚀 Running the Backend

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3000
```

---

## 📧 Support

For questions or issues, contact the backend team.