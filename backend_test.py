#!/usr/bin/env python3
"""
VODSTREAM Backend API Testing Suite
Tests the implemented APIs for the streaming platform
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://streamflix-3916.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "giovanepires17@hotmail.com"
ADMIN_PASSWORD = "admin123"

class VODStreamTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_cookies = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details
        })
    
    def login_admin(self) -> bool:
        """Login as admin user to get authentication cookies"""
        try:
            print("\n🔐 Logging in as admin...")
            
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.auth_cookies = self.session.cookies
                    self.log_result("Admin Login", True, f"Successfully logged in as {ADMIN_EMAIL}")
                    return True
                else:
                    self.log_result("Admin Login", False, f"Login failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Admin Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_search_api(self):
        """Test Search API with startsWith case-insensitive functionality"""
        print("\n🔍 Testing Search API...")
        
        # Test cases for search functionality
        test_cases = [
            {
                'query': 'star',
                'description': 'Search for "star" (lowercase)'
            },
            {
                'query': 'STAR', 
                'description': 'Search for "STAR" (uppercase) - case insensitive test'
            },
            {
                'query': 'uma',
                'description': 'Search for "uma" (Portuguese test)'
            },
            {
                'query': 'A',
                'description': 'Search for single letter "A"'
            }
        ]
        
        for test_case in test_cases:
            try:
                query = test_case['query']
                description = test_case['description']
                
                response = self.session.get(
                    f"{API_BASE}/vods",
                    params={'q': query, 'limit': 10}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check response structure
                    if 'vods' in data and 'series' in data and 'total' in data:
                        vods = data.get('vods', [])
                        series = data.get('series', [])
                        total = data.get('total', 0)
                        
                        # Verify startsWith functionality
                        all_start_with_query = True
                        items_checked = 0
                        
                        for vod in vods:
                            if vod.get('title'):
                                items_checked += 1
                                if not vod['title'].lower().startswith(query.lower()):
                                    all_start_with_query = False
                                    break
                        
                        for s in series:
                            if s.get('title'):
                                items_checked += 1
                                if not s['title'].lower().startswith(query.lower()):
                                    all_start_with_query = False
                                    break
                        
                        if items_checked == 0:
                            self.log_result(
                                f"Search API - {description}",
                                True,
                                f"No results found (empty database is acceptable)",
                                {'query': query, 'total': total}
                            )
                        elif all_start_with_query:
                            self.log_result(
                                f"Search API - {description}",
                                True,
                                f"Found {total} results, all start with '{query}' (case-insensitive)",
                                {'query': query, 'vods': len(vods), 'series': len(series), 'total': total}
                            )
                        else:
                            self.log_result(
                                f"Search API - {description}",
                                False,
                                f"Some results don't start with '{query}' - startsWith not working correctly",
                                {'query': query, 'total': total}
                            )
                    else:
                        self.log_result(
                            f"Search API - {description}",
                            False,
                            "Invalid response structure - missing vods, series, or total fields",
                            data
                        )
                else:
                    self.log_result(
                        f"Search API - {description}",
                        False,
                        f"HTTP {response.status_code}: {response.text}",
                        {'query': query}
                    )
                    
            except Exception as e:
                self.log_result(
                    f"Search API - {description}",
                    False,
                    f"Exception: {str(e)}",
                    {'query': query}
                )
    
    def test_series_api(self):
        """Test Series API - GET /api/series"""
        print("\n📺 Testing Series API...")
        
        try:
            response = self.session.get(f"{API_BASE}/series")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if 'series' in data and 'pagination' in data:
                    series_list = data.get('series', [])
                    pagination = data.get('pagination', {})
                    
                    # Verify series structure
                    if len(series_list) == 0:
                        self.log_result(
                            "Series API - List Series",
                            True,
                            "API working correctly, no series found (empty database is acceptable)",
                            {'count': 0, 'pagination': pagination}
                        )
                    else:
                        # Check first series structure
                        first_series = series_list[0]
                        required_fields = ['id', 'title', 'episodeCount']
                        
                        missing_fields = [field for field in required_fields if field not in first_series]
                        
                        if not missing_fields:
                            self.log_result(
                                "Series API - List Series",
                                True,
                                f"Found {len(series_list)} series with correct structure",
                                {
                                    'count': len(series_list),
                                    'sample_series': first_series.get('title'),
                                    'episode_count': first_series.get('episodeCount'),
                                    'pagination': pagination
                                }
                            )
                        else:
                            self.log_result(
                                "Series API - List Series",
                                False,
                                f"Series missing required fields: {missing_fields}",
                                {'first_series': first_series}
                            )
                else:
                    self.log_result(
                        "Series API - List Series",
                        False,
                        "Invalid response structure - missing series or pagination fields",
                        data
                    )
            else:
                self.log_result(
                    "Series API - List Series",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_result(
                "Series API - List Series",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_series_detail_api(self):
        """Test Series Detail API - GET /api/series/{id}"""
        print("\n📋 Testing Series Detail API...")
        
        try:
            # First get list of series to test with
            response = self.session.get(f"{API_BASE}/series")
            
            if response.status_code == 200:
                data = response.json()
                series_list = data.get('series', [])
                
                if len(series_list) == 0:
                    self.log_result(
                        "Series Detail API",
                        True,
                        "No series available to test detail API (empty database is acceptable)"
                    )
                    return
                
                # Test with first series
                series_id = series_list[0]['id']
                series_title = series_list[0]['title']
                
                detail_response = self.session.get(f"{API_BASE}/series/{series_id}")
                
                if detail_response.status_code == 200:
                    detail_data = detail_response.json()
                    
                    if 'series' in detail_data:
                        series_detail = detail_data['series']
                        required_fields = ['id', 'title', 'totalEpisodes', 'totalSeasons', 'seasons']
                        
                        missing_fields = [field for field in required_fields if field not in series_detail]
                        
                        if not missing_fields:
                            seasons = series_detail.get('seasons', {})
                            self.log_result(
                                "Series Detail API",
                                True,
                                f"Series detail working correctly for '{series_title}'",
                                {
                                    'series_id': series_id,
                                    'title': series_detail.get('title'),
                                    'total_episodes': series_detail.get('totalEpisodes'),
                                    'total_seasons': series_detail.get('totalSeasons'),
                                    'seasons_structure': list(seasons.keys()) if seasons else []
                                }
                            )
                        else:
                            self.log_result(
                                "Series Detail API",
                                False,
                                f"Series detail missing required fields: {missing_fields}",
                                {'series_detail': series_detail}
                            )
                    else:
                        self.log_result(
                            "Series Detail API",
                            False,
                            "Invalid response structure - missing series field",
                            detail_data
                        )
                elif detail_response.status_code == 404:
                    self.log_result(
                        "Series Detail API",
                        False,
                        f"Series not found (404) for ID: {series_id}",
                        {'series_id': series_id, 'title': series_title}
                    )
                else:
                    self.log_result(
                        "Series Detail API",
                        False,
                        f"HTTP {detail_response.status_code}: {detail_response.text}",
                        {'series_id': series_id}
                    )
            else:
                self.log_result(
                    "Series Detail API",
                    False,
                    f"Failed to get series list for testing: HTTP {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Series Detail API",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_episode_stream_api(self):
        """Test Episode Stream API - GET /api/episode/{id}/stream (requires authentication)"""
        print("\n🎬 Testing Episode Stream API...")
        
        if not self.auth_cookies:
            self.log_result(
                "Episode Stream API",
                False,
                "Cannot test - admin authentication failed"
            )
            return
        
        try:
            # First get series with episodes
            response = self.session.get(f"{API_BASE}/series")
            
            if response.status_code == 200:
                data = response.json()
                series_list = data.get('series', [])
                
                if len(series_list) == 0:
                    self.log_result(
                        "Episode Stream API",
                        True,
                        "No series available to test episode stream API (empty database is acceptable)"
                    )
                    return
                
                # Find a series with episodes
                episode_id = None
                series_title = None
                
                for series in series_list:
                    if series.get('episodeCount', 0) > 0:
                        series_id = series['id']
                        series_title = series['title']
                        
                        # Get series detail to find episode ID
                        detail_response = self.session.get(f"{API_BASE}/series/{series_id}")
                        if detail_response.status_code == 200:
                            detail_data = detail_response.json()
                            seasons = detail_data.get('series', {}).get('seasons', {})
                            
                            # Find first episode
                            for season_num, episodes in seasons.items():
                                if episodes and len(episodes) > 0:
                                    episode_id = episodes[0]['id']
                                    break
                            
                            if episode_id:
                                break
                
                if not episode_id:
                    self.log_result(
                        "Episode Stream API",
                        True,
                        "No episodes available to test stream API (empty database is acceptable)"
                    )
                    return
                
                # Test episode stream API
                stream_response = self.session.get(
                    f"{API_BASE}/episode/{episode_id}/stream",
                    cookies=self.auth_cookies
                )
                
                if stream_response.status_code == 200:
                    stream_data = stream_response.json()
                    
                    if 'url' in stream_data:
                        self.log_result(
                            "Episode Stream API",
                            True,
                            f"Episode stream API working correctly",
                            {
                                'episode_id': episode_id,
                                'series': series_title,
                                'stream_url_provided': bool(stream_data.get('url')),
                                'title': stream_data.get('title')
                            }
                        )
                    else:
                        self.log_result(
                            "Episode Stream API",
                            False,
                            "Invalid response structure - missing url field",
                            stream_data
                        )
                elif stream_response.status_code == 403:
                    self.log_result(
                        "Episode Stream API",
                        False,
                        "Access denied (403) - subscription required or inactive",
                        {'episode_id': episode_id}
                    )
                elif stream_response.status_code == 404:
                    self.log_result(
                        "Episode Stream API",
                        False,
                        f"Episode not found (404) for ID: {episode_id}",
                        {'episode_id': episode_id}
                    )
                elif stream_response.status_code == 401:
                    self.log_result(
                        "Episode Stream API",
                        False,
                        "Unauthorized (401) - authentication failed",
                        {'episode_id': episode_id}
                    )
                else:
                    self.log_result(
                        "Episode Stream API",
                        False,
                        f"HTTP {stream_response.status_code}: {stream_response.text}",
                        {'episode_id': episode_id}
                    )
            else:
                self.log_result(
                    "Episode Stream API",
                    False,
                    f"Failed to get series list for testing: HTTP {response.status_code}"
                )
                
        except Exception as e:
            self.log_result(
                "Episode Stream API",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n❤️ Testing Health Endpoints...")
        
        # Test health endpoint
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log_result("Health Endpoint", True, "Health endpoint working correctly")
                else:
                    self.log_result("Health Endpoint", False, f"Unexpected health status: {data}")
            else:
                self.log_result("Health Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Health Endpoint", False, f"Exception: {str(e)}")
        
        # Test ready endpoint
        try:
            response = self.session.get(f"{API_BASE}/ready")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ready':
                    self.log_result("Ready Endpoint", True, "Ready endpoint working correctly")
                else:
                    self.log_result("Ready Endpoint", False, f"Unexpected ready status: {data}")
            else:
                self.log_result("Ready Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Ready Endpoint", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting VODSTREAM Backend API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🔗 API Base: {API_BASE}")
        print("=" * 60)
        
        # Test basic health endpoints first
        self.test_health_endpoints()
        
        # Login as admin for authenticated tests
        login_success = self.login_admin()
        
        # Run API tests
        self.test_search_api()
        self.test_series_api()
        self.test_series_detail_api()
        
        if login_success:
            self.test_episode_stream_api()
        else:
            self.log_result(
                "Episode Stream API",
                False,
                "Skipped - admin login failed"
            )
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)
        
        # Return exit code
        return 0 if failed_tests == 0 else 1

if __name__ == "__main__":
    tester = VODStreamTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)