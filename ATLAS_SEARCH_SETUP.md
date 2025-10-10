# MongoDB Atlas Search Setup Guide

## Overview
This guide will help you set up MongoDB Atlas Search indexes for the food search API. Atlas Search provides powerful full-text search, fuzzy matching, and geospatial search capabilities.

## Prerequisites
- MongoDB Atlas cluster (M10 or higher for Atlas Search)
- Access to Atlas UI with appropriate permissions

## Step 1: Create Atlas Search Indexes

### 1. Business Search Index

1. Go to your MongoDB Atlas dashboard
2. Navigate to your cluster → Search → Create Index
3. Choose "JSON Editor"
4. Use collection: `businesses`
5. Index name: `business_search`
6. Paste this configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "businessName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "tags": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "state": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "active": {
        "type": "boolean"
      },
      "dealsCount": {
        "type": "number"
      },
      "priority": {
        "type": "number"
      }
    }
  }
}
```

### 2. Deal Search Index

1. Create another index
2. Collection: `deals`
3. Index name: `deal_search`
4. Configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "offerName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "description": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "menu": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "course": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "cuisine": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "categoryName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "tags": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "businessName": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "status": {
        "type": "string"
      },
      "promoStartDate": {
        "type": "date"
      },
      "promoEndDate": {
        "type": "date"
      },
      "offer": {
        "type": "number"
      },
      "businessId": {
        "type": "objectId"
      }
    }
  }
}
```

### 3. Location Search Index (for geospatial search)

1. Create another index
2. Collection: `locations`
3. Index name: `location_search`
4. Configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "loc": {
        "type": "geo"
      },
      "address": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "city": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "state": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "businessId": {
        "type": "objectId"
      },
      "isAvailable": {
        "type": "boolean"
      }
    }
  }
}
```

## Step 2: Verify Index Creation

After creating the indexes, wait for them to build (usually takes a few minutes). You can check the status in the Atlas UI.

## Step 3: Test the API

Once indexes are built, test your search API:

```bash
# Test business search
curl "http://localhost:3000/api/search?query=pizza&type=business"

# Test location-based search
curl "http://localhost:3000/api/search?query=italian&latitude=40.7128&longitude=-74.0060&radius=5000"

# Test deal/food search
curl "http://localhost:3000/api/search?query=burger&type=food"
```

## Features Enabled

✅ **Fuzzy Search** - Handles typos and partial matches
✅ **Geospatial Search** - Distance-based filtering and sorting
✅ **Multi-field Search** - Searches across multiple fields simultaneously
✅ **Relevance Scoring** - Results ranked by search relevance
✅ **Real-time Filtering** - Active businesses/deals, date ranges
✅ **Performance** - Optimized for large datasets

## Troubleshooting

### Index Not Found Error
- Ensure indexes are created with exact names: `business_search`, `deal_search`, `location_search`
- Wait for indexes to finish building (check Atlas UI)

### No Results Returned
- Verify your data has the expected field names
- Check that `active: true` and `status: 'active'` fields exist
- Ensure location data has proper `loc.coordinates` format

### Geospatial Search Issues
- Verify `loc` field format: `{ type: "Point", coordinates: [longitude, latitude] }`
- Ensure coordinates are numbers, not strings
- Check that `isAvailable: true` exists in location documents

## Performance Tips

1. **Index only necessary fields** - Reduces index size and improves performance
2. **Use compound queries** - Combine text search with filters for better results
3. **Limit result sets** - Use appropriate limit values for pagination
4. **Monitor usage** - Check Atlas Search metrics for optimization opportunities

Your Atlas Search implementation is now ready for production-grade food search with fuzzy matching and location-based results!