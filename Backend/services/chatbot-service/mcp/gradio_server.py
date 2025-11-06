"""
Smart Tro MCP Server - FastAPI for Guided Conversation
Tạo API endpoint để phục vụ guided conversation cho frontend
"""
import json
import asyncio
import re
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import threading

# Pydantic models cho API
class ChatMessage(BaseModel):
    message: str
    sessionId: Optional[str] = None
    conversationState: Optional[Dict] = None

class ChatResponse(BaseModel):
    success: bool
    message: str
    step: str
    options: Optional[List[str]] = None
    properties: Optional[List[Dict]] = None
    totalFound: Optional[int] = None
    conversationState: Dict
    showGrid: Optional[bool] = False   
    placeholder: Optional[str] = None
    searchCriteria: Optional[Dict] = None
class SmartTroMCP:
    def __init__(self):
        self.property_search_url = "http://localhost:5000/api/search-properties/properties"
        self.location_api_url = "https://vietnamlabs.com/api"
        self.amenities_api_url = "http://localhost:5000/api/amenities/all"
        
        # Cache cho wards data
        self.wards_cache = None
        
        # Cache để tránh gọi API nhiều lần
        self.provinces_cache = None
        self.amenities_cache = None
        
        # Session storage (trong production nên dùng Redis hoặc database)
        self.conversation_sessions = {}
        
        # Load data khi khởi tạo
        self._load_initial_data()
        
        # Định nghĩa conversation flow
        self.conversation_flow = {
            'greeting': {
                'message': "Bạn muốn được giúp đỡ tìm kiếm về vấn đề nào?",
                'options': ['Tìm trọ phù hợp', 'Tìm căn hộ phù hợp'],
                'expects': 'property_type',
                'next_step': 'property_type'
            },
            'property_type': {
                'message': "Vui lòng cho Chatbot biết ngân sách hàng tháng của bạn để Bot có thể tìm kiếm các lựa chọn phù hợp?",
                'expects': 'budget',
                'next_step': 'budget_input'
            },
            'budget_input': {
                'message': "Ngoài ra bạn còn cần thêm yêu cầu nào khác dưới đây không?",
                'options': ['Khu vực cụ thể', 'Diện tích chỗ thuê', 'Tiện ích cần có', 'Thêm thông tin khác'],
                'expects': 'additional_choice',
                'next_step': 'additional_options'
            },
            'additional_options': {
                'location': {
                    'message': "Vui lòng cho biết khu vực cụ thể (tỉnh, thành phố) mà bạn muốn tìm?",
                    'expects': 'location_detail',
                    'next_step': 'confirm_search'
                },
                'area': {
                    'message': "Vui lòng nhập diện tích mà bạn mong muốn (m2)?",
                    'expects': 'area_value',
                    'next_step': 'confirm_search'
                },
                'amenities': {
                    'message': "Vui lòng cho biết những tiện ích bạn mong muốn (wifi, điều hòa, máy giặt, etc.)?",
                    'expects': 'amenities_list',
                    'next_step': 'confirm_search'
                },
                'other': {
                    'message': "Nhập thêm trường đại học mà bạn đang theo học?",
                    'expects': 'university_info',
                    'next_step': 'confirm_search'
                }
            },
            'confirm_search': {
                'message': "Bạn cần thêm hoặc sửa yêu cầu không?",
                'options': ['Thêm yêu cầu', 'Tìm kiếm'],
                'expects': 'search_decision',
                'next_step': 'search_or_continue'
            }
        }
    
    def _load_initial_data(self):
        """Load provinces và amenities vào cache"""
        try:
            # Load provinces từ vietnamlabs.com API
            response = requests.get(f"{self.location_api_url}/vietnamprovince")
            if response.status_code == 200:
                provinces_data = response.json()
                # Chuyển đổi format để tương thích với code hiện tại
                self.provinces_cache = []
                if isinstance(provinces_data, list):
                    for province in provinces_data:
                        self.provinces_cache.append({
                            'name': province.get('name', ''),
                            'code': province.get('name', '').lower().replace(' ', '_')
                        })
                print(f"Loaded {len(self.provinces_cache)} provinces from vietnamlabs.com")
            
            # Load amenities
            response = requests.get(self.amenities_api_url)
            if response.status_code == 200:
                data = response.json()
                # Extract amenities from nested structure
                if 'data' in data and 'amenities' in data['data']:
                    self.amenities_cache = data['data']['amenities']
                elif 'amenities' in data:
                    self.amenities_cache = data['amenities']
                else:
                    self.amenities_cache = data if isinstance(data, list) else []
                
                print(f"Loaded {len(self.amenities_cache)} amenities")
        except Exception as e:
            print(f"Error loading initial data: {e}")
    
    def _get_province_name_by_keyword(self, keyword: str) -> Optional[str]:
        """Tìm tên tỉnh từ keyword"""
        if not self.provinces_cache:
            return None
        
        keyword = keyword.lower().strip()
        for province in self.provinces_cache:
            if keyword in province['name'].lower():
                return province['name']
        return None
    
    def _get_amenity_ids_by_names(self, amenity_names: List[str]) -> List[str]:
        """Tìm amenity IDs từ danh sách tên tiện ích"""
        if not self.amenities_cache:
            return []
        
        amenity_ids = []
        print(f"Searching for amenities: {amenity_names}")
        print(f"Available amenities: {[a['name'] for a in self.amenities_cache]}")
        
        for amenity_name in amenity_names:
            amenity_name_lower = amenity_name.lower().strip()
            found = False
            
            for amenity in self.amenities_cache:
                amenity_db_name = amenity['name'].lower().strip()
                
                # Exact match hoặc substring match
                if (amenity_name_lower == amenity_db_name or 
                    amenity_name_lower in amenity_db_name or 
                    amenity_db_name in amenity_name_lower):
                    amenity_ids.append(str(amenity['_id']))
                    print(f"Matched: '{amenity_name}' -> '{amenity['name']}' (ID: {amenity['_id']})")
                    found = True
                    break
            
            if not found:
                print(f"No match found for: '{amenity_name}'")
        
        print(f"Final amenity IDs: {amenity_ids}")
        return amenity_ids
    
    def _fetch_wards_from_vietnamlabs(self, province_name: str = None) -> List[Dict[str, Any]]:
        """
        Fetch wards từ vietnamlabs.com API tương tự fetchWards trong locationService.js
        """
        if self.wards_cache:
            return self.wards_cache
            
        try:
            all_wards = []
            
            if province_name:
                # Fetch wards cho một tỉnh cụ thể
                encoded_province = requests.utils.quote(province_name)
                url = f"{self.location_api_url}/vietnamprovince?province={encoded_province}&limit=1000&offset=0"
                response = requests.get(url, timeout=5)
                
                if response.status_code == 200:
                    wards_data = response.json()
                    if isinstance(wards_data, list):
                        for ward in wards_data:
                            all_wards.append(ward)
            else:
                # Fetch wards từ tất cả các tỉnh
                if self.provinces_cache:
                    for province in self.provinces_cache:
                        try:
                            encoded_province = requests.utils.quote(province['name'])
                            url = f"{self.location_api_url}/vietnamprovince?province={encoded_province}&limit=1000&offset=0"
                            response = requests.get(url, timeout=5)
                            
                            if response.status_code == 200:
                                wards_data = response.json()
                                if isinstance(wards_data, list):
                                    for ward in wards_data:
                                        all_wards.append(ward)
                        except Exception as e:
                            print(f"Error fetching wards for province {province['name']}: {e}")
                            continue
            
            # Chuyển đổi theo format yêu cầu (giống fetchWards trong locationService.js)
            formatted_wards = []
            for index, ward in enumerate(all_wards):
                formatted_wards.append({
                    'id': index,  # Simple index cho frontend
                    'code': ward.get('name', ''),  # Sử dụng tên ward làm code để match với schema
                    'name': ward.get('name', ''),  # Tên ward để hiển thị và lưu vào DB
                    'province': ward.get('province', ''),
                    'mergedFrom': ward.get('mergedFrom', [])  # Đảm bảo luôn có array, không undefined
                })
            
            # Cache kết quả
            self.wards_cache = formatted_wards
            print(f"Loaded {len(formatted_wards)} wards from vietnamlabs.com")
            return formatted_wards
            
        except Exception as e:
            print(f"Error fetching wards from vietnamlabs.com: {e}")
            return []
    
    def _fuzzy_match_ward_name(self, keyword: str, wards_list: List[Dict]) -> Optional[str]:
        """
        So sánh chuỗi gần đúng để tìm ward name từ keyword
        """
        if not keyword or not wards_list:
            return None
        
        keyword_lower = keyword.lower().strip()
        
        # Chỉ loại bỏ các prefix không phải "phường" và "xã" đầy đủ
        prefixes_to_remove = ['thị trấn', 'p.', 'p', 'ward', 'commune']
        cleaned_keyword = keyword_lower
        
        for prefix in prefixes_to_remove:
            if cleaned_keyword.startswith(prefix + ' '):
                cleaned_keyword = cleaned_keyword[len(prefix + ' '):].strip()
                break
            elif cleaned_keyword.startswith(prefix):
                cleaned_keyword = cleaned_keyword[len(prefix):].strip()
                break
        
        best_match = None
        best_score = 0
        
        for ward in wards_list:
            ward_name = ward['name'].lower().strip()
            
            # Loại bỏ prefix từ ward name để so sánh (trừ "phường" và "xã" đầy đủ)
            cleaned_ward_name = ward_name
            for prefix in prefixes_to_remove:
                if cleaned_ward_name.startswith(prefix + ' '):
                    cleaned_ward_name = cleaned_ward_name[len(prefix + ' '):].strip()
                    break
                elif cleaned_ward_name.startswith(prefix):
                    cleaned_ward_name = cleaned_ward_name[len(prefix):].strip()
                    break
            
            # 1. Exact match - ưu tiên cao nhất
            if cleaned_keyword == cleaned_ward_name or keyword_lower == ward_name:
                return ward['name']
            
            # 2. Substring match
            if cleaned_keyword in cleaned_ward_name or cleaned_ward_name in cleaned_keyword:
                score = min(len(cleaned_keyword), len(cleaned_ward_name)) / max(len(cleaned_keyword), len(cleaned_ward_name))
                if score > best_score:
                    best_score = score
                    best_match = ward['name']
            
            # 3. Word-based matching cho tên compound
            keyword_words = set(cleaned_keyword.split())
            ward_words = set(cleaned_ward_name.split())
            
            if keyword_words and ward_words:
                common_words = keyword_words.intersection(ward_words)
                if common_words:
                    word_score = len(common_words) / max(len(keyword_words), len(ward_words))
                    if word_score > best_score and word_score >= 0.5:  # Threshold cho word matching
                        best_score = word_score
                        best_match = ward['name']
            
            # 4. Character similarity (Levenshtein-like approach đơn giản)
            if len(cleaned_keyword) >= 3 and len(cleaned_ward_name) >= 3:
                similarity = self._calculate_string_similarity(cleaned_keyword, cleaned_ward_name)
                if similarity > best_score and similarity >= 0.7:  # Threshold cho character similarity
                    best_score = similarity
                    best_match = ward['name']
        
        # Chỉ return nếu match score đủ cao
        if best_score >= 0.6:  # Threshold tổng quát
            print(f"Ward fuzzy matched: '{keyword}' -> '{best_match}' (score: {best_score:.2f})")
            return best_match
        
        return None
    
    def _calculate_string_similarity(self, str1: str, str2: str) -> float:
        """
        Tính độ tương tự giữa hai chuỗi (đơn giản hóa Levenshtein distance)
        """
        if not str1 or not str2:
            return 0.0
        
        if str1 == str2:
            return 1.0
        
        # Tính số ký tự chung
        str1_chars = set(str1.lower())
        str2_chars = set(str2.lower())
        
        common_chars = str1_chars.intersection(str2_chars)
        total_chars = str1_chars.union(str2_chars)
        
        if not total_chars:
            return 0.0
        
        return len(common_chars) / len(total_chars)
    
    def _extract_location_from_text(self, text: str) -> Dict[str, Optional[str]]:
        """Trích xuất thông tin location từ text (province và ward)"""
        result = {'province_name': None, 'ward_name': None}
        
        text_lower = text.lower()
        
        # Ưu tiên tìm phường/xã trước để tránh nhầm lẫn với province
        ward_patterns = [
            (r'(phường)\s+([a-zA-ZÀ-ỹ0-9\s]+?)(?:\s*[,.]|$)', 'phường'),     # "phường tân định" -> giữ nguyên "Phường Tân Định"
            (r'(xã)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*[,.]|$)', 'xã'),               # "xã tân phú" -> giữ nguyên "Xã Tân Phú"
            (r'(thị trấn)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*[,.]|$)', 'thị trấn'),   # "thị trấn long thành" -> "Thị Trấn Long Thành"
            (r'(?:p\.?)\s+([a-zA-Z0-9\s]+?)(?:\s*[,.]|$)', None),            # "p. tân định" -> chỉ lấy tên không có prefix
            (r'(?:ward)\s+([a-zA-Z0-9\s]+?)(?:\s*[,.]|$)', None)             # "ward tan dinh" -> chỉ lấy tên không có prefix
        ]
        
        for pattern_info in ward_patterns:
            if isinstance(pattern_info, tuple):
                pattern, prefix_to_keep = pattern_info
                matches = re.findall(pattern, text_lower)
                if matches:
                    if len(matches[0]) == 2 and prefix_to_keep:  # Có prefix để giữ
                        prefix, ward_name = matches[0]
                        result['ward_name'] = f"{prefix_to_keep.title()} {ward_name.strip().title()}"
                    else:  # Không giữ prefix hoặc chỉ có tên
                        ward_name = matches[0][1] if len(matches[0]) == 2 else matches[0]
                        result['ward_name'] = ward_name.strip().title()
                    break
            else:  # Backward compatibility cho pattern cũ
                matches = re.findall(pattern_info, text_lower)
                if matches:
                    ward_name = matches[0].strip()
                    result['ward_name'] = ward_name.title()
                    break
        
        # Chỉ tìm province nếu có prefix rõ ràng hoặc tên thành phố lớn
        # Patterns cụ thể cho province (không dùng pattern tổng quát gây nhầm lẫn)
        province_patterns = [
            r'(?:tp|thành phố)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*[,.]|$)',  # "tp hồ chí minh" or "thành phố hồ chí minh"
            r'(?:tỉnh)\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s*[,.]|$)',         # "tỉnh an giang"
            r'([a-zA-ZÀ-ỹ\s]+?)\s+(?:province|city)',              # "ho chi minh city"
            r'(hồ chí minh|hà nội|đà nẵng|cần thơ|hải phòng|an giang|bà rịa|bắc giang|bắc kạn|bạc liêu|bắc ninh|bến tre|bình định|bình dương|bình phước|bình thuận|cà mau|cao bằng|đắk lắk|đắk nông|điện biên|đồng nai|đồng tháp|gia lai|hà giang|hà nam|hà tĩnh|hải dương|hậu giang|hòa bình|hưng yên|khánh hòa|kiên giang|kon tum|lai châu|lâm đồng|lạng sơn|lào cai|long an|nam định|nghệ an|ninh bình|ninh thuận|phú thọ|phú yên|quảng bình|quảng nam|quảng ngãi|quảng ninh|quảng trị|sóc trăng|sơn la|tây ninh|thái bình|thái nguyên|thanh hóa|thừa thiên|tiền giang|trà vinh|tuyên quang|vĩnh long|vĩnh phúc|yên bái)(?=\s|$|[,.])',  # Tên tỉnh/thành phố cụ thể
        ]
        
        for pattern in province_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                province_name = matches[0].strip()
                # Normalize common city names
                if 'hồ chí minh' in province_name or 'hcm' in province_name or 'sài gòn' in province_name:
                    result['province_name'] = 'Hồ Chí Minh'
                elif 'hà nội' in province_name:
                    result['province_name'] = 'Hà Nội'
                elif 'đà nẵng' in province_name:
                    result['province_name'] = 'Đà Nẵng'
                elif 'cần thơ' in province_name:
                    result['province_name'] = 'Cần Thơ'
                elif 'hải phòng' in province_name:
                    result['province_name'] = 'Hải Phòng'
                else:
                    result['province_name'] = province_name.title()
                break
        
        # Fallback: Tìm province bằng cache nếu chưa có ward và có prefix rõ ràng
        if not result['province_name'] and not result['ward_name'] and self.provinces_cache:
            # Chỉ tìm trong cache nếu có prefix "tỉnh" hoặc "thành phố"
            if any(prefix in text_lower for prefix in ['tỉnh ', 'thành phố ', 'tp ']):
                for province in self.provinces_cache:
                    province_name_lower = province['name'].lower()
                    # Tìm exact match hoặc substring trong text có prefix
                    if province_name_lower in text_lower:
                        result['province_name'] = province['name']
                        break
        
        return result
    
    def _extract_amenities_from_text(self, text: str) -> List[str]:
        """Trích xuất danh sách amenities từ text"""
        # Các từ khóa tiện ích phổ biến
        amenity_keywords = {
            'wifi': ['wifi', 'internet', 'mạng'],
            'điều hòa': ['điều hòa', 'máy lạnh', 'air conditioner', 'ac'],
            'máy giặt': ['máy giặt', 'washing machine'],
            'tủ lạnh': ['tủ lạnh', 'refrigerator', 'fridge'],
            'bếp': ['bếp', 'kitchen', 'nấu ăn'],
            'gác lửng': ['gác lửng', 'loft'],
            'ban công': ['ban công', 'balcony'],
            'toilet riêng': ['toilet riêng', 'wc riêng', 'nhà vệ sinh riêng'],
            'bảo vệ': ['bảo vệ', 'security', 'an ninh'],
            'thang máy': ['thang máy', 'elevator', 'lift'],
            'chỗ để xe': ['chỗ để xe', 'parking', 'gửi xe']
        }
        
        text_lower = text.lower()
        found_amenities = []
        
        for amenity_name, keywords in amenity_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    found_amenities.append(amenity_name)
                    break
        
        # Map sang amenity IDs
        return self._get_amenity_ids_by_names(found_amenities)

    def process_guided_message(self, user_message: str, conversation_state: Dict = None) -> Dict[str, Any]:
        """
        Xử lý tin nhắn theo guided conversation flow
        """
        if not conversation_state:
            conversation_state = {
                'current_step': 'greeting',
                'collected_data': {},
                'conversation_history': []
            }
        
        current_step = conversation_state.get('current_step', 'greeting')
        collected_data = conversation_state.get('collected_data', {})
        
        # Xử lý theo từng step
        if current_step == 'greeting':
            return self._handle_greeting(user_message, conversation_state)
        elif current_step == 'property_type':
            return self._handle_property_type(user_message, conversation_state)
        elif current_step == 'budget_input':
            return self._handle_budget_input(user_message, conversation_state)
        elif current_step == 'additional_options':
            return self._handle_additional_options(user_message, conversation_state)
        elif current_step == 'location_input':
            return self._handle_location_detail_input(user_message, conversation_state)
        elif current_step == 'area_input':
            return self._handle_area_input(user_message, conversation_state)
        elif current_step == 'amenities_input':
            return self._handle_amenities_input(user_message, conversation_state)
        elif current_step == 'university_input':
            return self._handle_university_input(user_message, conversation_state)
        elif current_step == 'confirm_search':
            return self._handle_confirm_search(user_message, conversation_state)
        else:
            return self._handle_search(conversation_state)
    
    def _handle_greeting(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý bước chào hỏi và chuyển sang chọn loại nhà"""
        # Extract location từ tin nhắn nếu có
        location = self._extract_location(user_message)
        state['collected_data']['location'] = location
        state['current_step'] = 'property_type'
        
        response = {
            'message': "Bạn muốn được giúp đỡ tìm kiếm về vấn đề nào?",
            'options': ['Tìm trọ phù hợp', 'Tìm căn hộ phù hợp'],
            'conversation_state': state,
            'step': 'property_type_selection'
        }
        return response
    

    
    def _handle_property_type(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc chọn loại property"""
        property_type = self._extract_property_type(user_message)
        state['collected_data']['property_type'] = property_type
        state['current_step'] = 'budget_input'
        
        response = {
            'message': "Vui lòng cho Chatbot biết ngân sách hàng tháng của bạn để Bot có thể tìm kiếm các lựa chọn phù hợp?",
            'conversation_state': state,
            'step': 'budget_input',
            'placeholder': 'Ví dụ: từ 2 triệu - 3 triệu'
        }
        return response
    
    def _handle_budget_input(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc nhập budget"""
        budget = self._extract_budget(user_message)
        state['collected_data']['budget'] = budget
        state['current_step'] = 'additional_options'
        
        response = {
            'message': "Ngoài ra bạn còn cần thêm yêu cầu nào khác dưới đây không?",
            'options': ['Khu vực cụ thể', 'Diện tích chỗ thuê', 'Tiện ích cần có', 'Thêm thông tin khác'],
            'conversation_state': state,
            'step': 'additional_requirements'
        }
        return response
    
    def _handle_additional_options(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc chọn yêu cầu bổ sung"""
        choice = user_message.lower()
        
        if 'khu vực' in choice:
            state['current_step'] = 'location_input'
            response = {
                'message': "Vui lòng cho biết khu vực cụ thể (tỉnh, thành phố, phường/xã) mà bạn muốn tìm ?",
                'conversation_state': state,
                'step': 'location_input',
                'placeholder': 'Ví dụ: Phường An Nhơn, Gò Vấp'
            }
        elif 'diện tích' in choice:
            state['current_step'] = 'area_input'
            response = {
                'message': "Vui lòng nhập diện tích mà bạn mong muốn (m2)?",
                'conversation_state': state,
                'step': 'area_input',
                'placeholder': 'Ví dụ: 50'
            }
        elif 'tiện ích' in choice:
            state['current_step'] = 'amenities_input'
            response = {
                'message': "Vui lòng cho biết những tiện ích bạn mong muốn?",
                'conversation_state': state,
                'step': 'amenities_input',
                'placeholder': 'Ví dụ: wifi, điều hòa, máy giặt'
            }
        else:  # Thêm thông tin khác
            state['current_step'] = 'university_input'
            response = {
                'message': "Nhập thêm trường đại học mà bạn đang theo học?",
                'conversation_state': state,
                'step': 'university_input',
                'placeholder': 'Ví dụ: Đại học Công nghiệp TP HCM'
            }
        
        return response
    
    def _handle_location_detail_input(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc nhập khu vực cụ thể"""
        location_data = self._extract_location_details(user_message)
        state['collected_data']['location_details'] = location_data
        return self._show_confirm_options(state)
    
    def _handle_area_input(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc nhập diện tích"""
        area = self._extract_area(user_message)
        state['collected_data']['area'] = area
        return self._show_confirm_options(state)
    
    def _handle_amenities_input(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc nhập tiện ích"""
        amenities = self._extract_amenities_with_ids(user_message)
        state['collected_data']['amenities'] = amenities
        return self._show_confirm_options(state)
    
    def _handle_university_input(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc nhập thông tin trường học"""
        university = self._extract_university(user_message)
        state['collected_data']['university'] = university
        return self._show_confirm_options(state)
    
    def _show_confirm_options(self, state: Dict) -> Dict[str, Any]:
        """Hiển thị options xác nhận"""
        state['current_step'] = 'confirm_search'
        response = {
            'message': "Bạn cần thêm hoặc sửa yêu cầu không?",
            'options': ['Thêm yêu cầu', 'Tìm kiếm'],
            'conversation_state': state,
            'step': 'confirm_search'
        }
        return response
    
    def _handle_confirm_search(self, user_message: str, state: Dict) -> Dict[str, Any]:
        """Xử lý việc xác nhận tìm kiếm hoặc thêm yêu cầu"""
        choice = user_message.lower()
        
        if 'thêm' in choice:
            # Quay lại bước chọn yêu cầu bổ sung
            state['current_step'] = 'additional_options'
            response = {
                'message': "Ngoài ra bạn còn cần thêm yêu cầu nào khác dưới đây không?",
                'options': ['Khu vực cụ thể', 'Diện tích chỗ thuê', 'Tiện ích cần có', 'Thêm thông tin khác'],
                'conversation_state': state,
                'step': 'additional_requirements'
            }
        else:
            # Tiến hành tìm kiếm
            return self._perform_search(state)
        
        return response
    
    def _perform_search(self, state: Dict) -> Dict[str, Any]:
        """Thực hiện tìm kiếm dựa trên collected data"""
        collected = state['collected_data']
        
        # Chuyển đổi collected data thành search criteria
        criteria = self._convert_to_search_criteria(collected)
        
        # Tìm kiếm properties
        properties = self.search_properties_fast(criteria)
        print('Found properties:', properties)

        # Trả về tất cả properties không giới hạn
        total_found = len(properties)

        # Tạo response với kết quả
        response = {
            'message': f"Tuyệt vời! Tôi đã tìm thấy {total_found} bài đăng phù hợp với yêu cầu của bạn.",
            'properties': properties,
            'total_found': total_found,
            'search_criteria': criteria,
            'conversation_state': state,
            'step': 'search_results',
            'show_grid': True
        }
        
        return response
    
    # Helper methods để extract thông tin
    def _extract_location(self, message: str) -> str:
        """Extract địa điểm từ tin nhắn"""
        message = message.lower()
        
        # Tìm tỉnh thành phố
        cities = [
            'hà nội', 'hồ chí minh', 'tp hcm', 'sài gòn', 'thành phố hồ chí minh',
            'đà nẵng', 'hải phòng', 'cần thơ', 'nha trang', 'vũng tàu', 'đà lạt'
        ]
        
        for city in cities:
            if city in message:
                return city.title()
        
        return message.strip()
    
    def _extract_property_type(self, message: str) -> str:
        """Extract loại property từ tin nhắn"""
        message = message.lower()
        
        if 'trọ' in message:
            return 'phong_tro'
        elif 'căn hộ' in message:
            return 'can_ho'
        
        return 'phong_tro'  # default
    
    def _extract_budget(self, message: str) -> Dict[str, float]:
        """Extract budget từ tin nhắn"""
        # Patterns để tìm giá tiền (theo thứ tự ưu tiên)
        price_patterns = [
            # Pattern có "từ...đến" với triệu
            (r'từ\s*(\d+(?:\.\d+)?)\s*(?:đến|-)\s*(\d+(?:\.\d+)?)\s*(?:triệu|tr)', 
             lambda x, y: {"min": float(x) * 1000000, "max": float(y) * 1000000}),
            
            # Pattern có "từ...đến" với số thuần (giả sử là VND)
            (r'từ\s*(\d+(?:\.\d+)?)\s*(?:đến|-)\s*(\d+(?:\.\d+)?)\s*(?:đồng|vnd|vnđ|$)?', 
             lambda x, y: {"min": float(x), "max": float(y)}),
            
            # Pattern "X triệu Y" (như "3 triệu 500" = 3.5 triệu)
            (r'(\d+)\s*(?:triệu|tr)\s*(\d+)', 
             lambda x, y: {"max": (float(x) + float(y)/1000) * 1000000}),
            
            # Pattern "dưới" với triệu
            (r'dưới\s*(\d+(?:\.\d+)?)\s*(?:triệu|tr)', 
             lambda x: {"max": float(x) * 1000000}),
            
            # Pattern "trên" với triệu
            (r'trên\s*(\d+(?:\.\d+)?)\s*(?:triệu|tr)', 
             lambda x: {"min": float(x) * 1000000}),
            
            # Pattern số + triệu (đơn giản)
            (r'(\d+(?:\.\d+)?)\s*(?:triệu|tr)', 
             lambda x: {"max": float(x) * 1000000}),
            
            # Pattern số thuần lớn (>= 100000, có thể là VND)
            (r'\b(\d{6,})\b', 
             lambda x: {"max": float(x)} if float(x) >= 100000 else None),
            
            # Pattern số nhỏ hơn (có thể là triệu)
            (r'\b(\d+(?:\.\d+)?)\b', 
             lambda x: {"max": float(x) * 1000000} if float(x) < 100 else {"max": float(x)})
        ]
        
        for i, (pattern, extractor) in enumerate(price_patterns):
            match = re.search(pattern, message.lower())
            if match:
                try:
                    if len(match.groups()) == 2:
                        result = extractor(match.group(1), match.group(2))
                    else:
                        result = extractor(match.group(1))
                    
                    if result:  # Kiểm tra kết quả không None
                        print(f"Budget extracted: {result}")
                        return result
                except Exception as e:
                    print(f"Error processing pattern {i+1}: {e}")
                    continue
        
        print("No budget pattern matched")
        return {}
    
    def _extract_area(self, message: str) -> float:
        """Extract diện tích từ tin nhắn"""
        match = re.search(r'(\d+(?:\.\d+)?)', message)
        if match:
            return float(match.group(1))
        return 0
    
    def _extract_location_details(self, message: str) -> Dict[str, Any]:
        """Extract thông tin location chi tiết (province và ward)"""
        location_info = self._extract_location_from_text(message)
        
        result = {
            'text': message.strip(),
            'province_name': location_info.get('province_name'),
            'ward_name': location_info.get('ward_name'),
            'keywords': []
        }
        
        # Thêm các keywords không map được province hoặc ward vào search text
        if not location_info.get('province_name') or not location_info.get('ward_name'):
            # Extract location keywords từ message
            location_patterns = [
                r'(?:quận|q\.?|huyện)\s+([^,\.\s]+(?:\s+[^,\.\s]+)*)',
                r'(?:tỉnh|thành phố|tp\.?)\s+([^,\.\s]+(?:\s+[^,\.\s]+)*)',
                r'(?:phường|p\.?|xã|thị trấn)\s+([^,\.\s]+(?:\s+[^,\.\s]+)*)',
                r'([a-zA-ZÀ-ỹ\s]+)(?=\s*[,\.]|$)'
            ]
            
            for pattern in location_patterns:
                matches = re.findall(pattern, message, re.IGNORECASE)
                for match in matches:
                    if match.strip():
                        # Chỉ thêm vào keywords nếu chưa được extract thành province/ward
                        match_text = match.strip()
                        if (match_text != location_info.get('province_name') and 
                            match_text != location_info.get('ward_name')):
                            result['keywords'].append(match_text)
        
        return result
    
    def _extract_amenities_with_ids(self, message: str) -> Dict[str, Any]:
        """Extract tiện ích từ tin nhắn và map sang Object IDs"""
        # Extract amenity names từ message
        amenity_names = []
        message_lower = message.lower()
        
        # Map keyword trong message với tên chính xác trong database
        # Dựa trên response API: Wifi, Máy lạnh, Tủ lạnh, Ban công, Máy giặt, Tủ quần áo, Nhà bếp, Bãi đỗ xe, Thang máy, Tivi
        amenity_mapping = {
            # Wifi
            'wifi': 'Wifi',
            'wi-fi': 'Wifi', 
            'mạng': 'Wifi',
            'internet': 'Wifi',
            
            # Máy lạnh
            'điều hòa': 'Máy lạnh',
            'máy lạnh': 'Máy lạnh',
            'air conditioner': 'Máy lạnh',
            'ac': 'Máy lạnh',
            
            # Tủ lạnh  
            'tủ lạnh': 'Tủ lạnh',
            'tủ đá': 'Tủ lạnh',
            'refrigerator': 'Tủ lạnh',
            'fridge': 'Tủ lạnh',
            
            # Ban công
            'ban công': 'Ban công',
            'balcony': 'Ban công',
            'sân phơi': 'Ban công',
            
            # Máy giặt
            'máy giặt': 'Máy giặt',
            'washing machine': 'Máy giặt',
            
            # Tủ quần áo
            'tủ quần áo': 'Tủ quần áo',
            'tủ áo': 'Tủ quần áo',
            'wardrobe': 'Tủ quần áo',
            
            # Nhà bếp
            'nhà bếp': 'Nhà bếp',
            'bếp': 'Nhà bếp',
            'kitchen': 'Nhà bếp',
            'nấu ăn': 'Nhà bếp',
            
            # Bãi đỗ xe
            'bãi đỗ xe': 'Bãi đỗ xe',
            'gửi xe': 'Bãi đỗ xe',
            'đỗ xe': 'Bãi đỗ xe',
            'parking': 'Bãi đỗ xe',
            'chỗ để xe': 'Bãi đỗ xe',
            
            # Thang máy
            'thang máy': 'Thang máy',
            'elevator': 'Thang máy',
            'lift': 'Thang máy',
            
            # Tivi
            'tivi': 'Tivi',
            'tv': 'Tivi',
            'television': 'Tivi'
        }
        
        # Tìm kiếm keywords trong message
        found_amenities = set()  # Dùng set để tránh duplicate
        for keyword, db_name in amenity_mapping.items():
            if keyword in message_lower:
                found_amenities.add(db_name)
        
        amenity_names = list(found_amenities)
        
        # Map amenity names to IDs using cached data
        amenity_ids = self._get_amenity_ids_by_names(amenity_names)
        
        return {
            'names': amenity_names,
            'ids': amenity_ids,
            'text': message.strip()
        }
    
    def _extract_amenities(self, message: str) -> List[str]:
        """Extract tiện ích từ tin nhắn (backward compatibility)"""
        result = self._extract_amenities_with_ids(message)
        return result['names']
    
    def _extract_university(self, message: str) -> str:
        """Extract thông tin trường đại học"""
        message_lower = message.lower()
        
        # Patterns cho trường đại học
        university_patterns = [
            r'(?:đh|đại học)\s+(công nghiệp|bách khoa|kinh tế|sư phạm|y dược|nông lâm|xây dựng|[^,\.\s]+(?:\s+[^,\.\s]+)*)',
            r'trường\s+(đại học\s+)?([^,\.\s]+(?:\s+[^,\.\s]+)*)',
            r'\b(uit|hcmut|hust|neu|fpt|rmit|tdt|tdtu|hutech)\b',
        ]
        
        for pattern in university_patterns:
            match = re.search(pattern, message_lower)
            if match:
                if isinstance(match.groups(), tuple) and len(match.groups()) > 1:
                    return ' '.join([g for g in match.groups() if g and g.strip()])
                else:
                    return match.group(1) if len(match.groups()) > 0 else match.group(0)
        
        return message.strip()
    
    def _convert_to_search_criteria(self, collected_data: Dict) -> Dict[str, Any]:
        """Chuyển đổi collected data thành search criteria cho API"""
        criteria = {
            "intent": "search",
            "confidence": 0.9,
            "category": collected_data.get('property_type'),
            "priceRange": collected_data.get('budget', {}),
            "location": {"keywords": [], "province": "", "ward": ""},
            "area": {},
            "amenities": [],
            "maxOccupants": "",
            "extractedKeywords": []
        }
        
        # Xử lý location details (có province name và ward name)
        if collected_data.get('location_details'):
            location_details = collected_data['location_details']
            if location_details.get('province_name'):
                criteria["location"]["province"] = location_details['province_name']
            if location_details.get('ward_name'):
                criteria["location"]["ward"] = location_details['ward_name']
            if location_details.get('keywords'):
                criteria["location"]["keywords"].extend(location_details['keywords'])
        
        # Xử lý location (từ bước greeting)
        if collected_data.get('location'):
            criteria["location"]["keywords"].append(collected_data['location'])
        
        # Xử lý university
        if collected_data.get('university'):
            criteria["location"]["keywords"].append(collected_data['university'])
        
        # Xử lý amenities với IDs
        if collected_data.get('amenities'):
            amenities_data = collected_data['amenities']
            if isinstance(amenities_data, dict) and 'ids' in amenities_data:
                criteria["amenities"] = amenities_data['ids']
            elif isinstance(amenities_data, list):
                criteria["amenities"] = amenities_data
        
        # Xử lý area
        if collected_data.get('area'):
            area_val = collected_data['area']
            criteria["area"] = {
                "min": area_val * 0.8,
                "max": area_val * 1.2
            }
        
        return criteria
    
    def process_guided_api(self, message: str, session_id: str = None, conversation_state: Dict = None) -> Dict[str, Any]:
        """
        API endpoint cho guided conversation
        """
        if not session_id:
            session_id = f"session_{datetime.now().timestamp()}"
        
        # Lấy hoặc tạo conversation state
        if session_id not in self.conversation_sessions:
            self.conversation_sessions[session_id] = {
                'current_step': 'greeting',
                'collected_data': {},
                'conversation_history': []
            }
        
        # Sử dụng state từ request hoặc session storage
        if conversation_state:
            self.conversation_sessions[session_id] = conversation_state
        
        current_state = self.conversation_sessions[session_id]
        
        # Xử lý tin nhắn
        result = self.process_guided_message(message, current_state)
        
        # Cập nhật session
        self.conversation_sessions[session_id] = result.get('conversation_state', current_state)
        
        # Thêm session_id vào response
        result['session_id'] = session_id
        result['success'] = True
        
        return result
    
    def search_properties_fast(self, criteria: Dict[str, Any]) -> List[Dict]:
        """
        Tìm kiếm properties nhanh qua API (sync version)
        Returns properties với direct fields: province, ward, detailAddress (đồng nhất với API search)
        """
        # Chuyển đổi criteria thành search params
        params = {
            "page": 1,
            "limit": 20,
            "sortBy": "promotedAt",
            "sortOrder": "desc"
        }
        
        if criteria["category"]:
            params["category"] = criteria["category"]
        
        if criteria["priceRange"].get("min"):
            params["minPrice"] = int(criteria["priceRange"]["min"])
        if criteria["priceRange"].get("max"):
            params["maxPrice"] = int(criteria["priceRange"]["max"])
            
        if criteria["area"].get("min"):
            params["minArea"] = int(criteria["area"]["min"])
        if criteria["area"].get("max"):
            params["maxArea"] = int(criteria["area"]["max"])
            
        if criteria["maxOccupants"]:
            params["maxOccupants"] = criteria["maxOccupants"]
        
        # Use province name directly (no more IDs)
        if criteria["location"].get("province"):
            params["province"] = criteria["location"]["province"]
            
        # Use ward name directly
        if criteria["location"].get("ward"):
            params["ward"] = criteria["location"]["ward"]
        
        # Fallback: Extract province and ward names from location keywords
        if not params.get("province") or not params.get("ward"):
            if criteria["location"]["keywords"]:
                keywords_text = " ".join(criteria["location"]["keywords"])
                location_info = self._extract_location_from_text(keywords_text)
                
                # Set province if not already set
                if not params.get("province") and location_info.get('province_name'):
                    params["province"] = location_info['province_name']
                
                # Set ward if not already set
                if not params.get("ward") and location_info.get('ward_name'):
                    params["ward"] = location_info['ward_name']
                
                # Fallback: Try to find province name in individual keywords
                if not params.get("province") and self.provinces_cache:
                    for keyword in criteria["location"]["keywords"]:
                        for province in self.provinces_cache:
                            if keyword.lower() in province['name'].lower():
                                params["province"] = province['name']
                                break
                        if params.get("province"):
                            break
                
                # Enhanced ward matching sử dụng vietnamlabs.com API
                if not params.get("ward"):
                    # Fetch wards data từ vietnamlabs.com
                    wards_list = self._fetch_wards_from_vietnamlabs()
                    
                    if wards_list:
                        for keyword in criteria["location"]["keywords"]:
                            # Thử fuzzy matching với từng keyword
                            matched_ward = self._fuzzy_match_ward_name(keyword, wards_list)
                            if matched_ward:
                                params["ward"] = matched_ward
                                print(f"Ward matched: '{keyword}' -> '{matched_ward}'")
                                break
        
        # Use amenity IDs if already mapped, otherwise try to map from text
        amenity_ids = []
        if criteria["amenities"]:
            if isinstance(criteria["amenities"], list) and criteria["amenities"]:
                # Check if first item looks like an ObjectId (24 chars hex)
                first_amenity = criteria["amenities"][0]
                if isinstance(first_amenity, str) and len(first_amenity) == 24:
                    params["amenities"] = ",".join(criteria["amenities"])
                    amenity_ids = criteria["amenities"]
                else:
                    # Try to map amenity names to IDs
                    amenity_ids = self._extract_amenities_from_text(" ".join(criteria["amenities"]))
                    if amenity_ids:
                        params["amenities"] = ",".join(amenity_ids)
        
        # Search text từ location keywords (nếu không map được province/ward name) và other keywords
        search_terms = []
        
        # Get location_info first
        location_info = {'province_name': None, 'ward_name': None}
        if criteria["location"]["keywords"]:
            location_info = self._extract_location_from_text(" ".join(criteria["location"]["keywords"]))
        
        # Chỉ thêm keywords chưa được map thành province hoặc ward
        if criteria["location"]["keywords"]:
            for keyword in criteria["location"]["keywords"]:
                keyword_lower = keyword.lower().strip()
                
                # Skip nếu keyword chứa trong province name đã map
                skip_keyword = False
                if params.get("province"):
                    province_lower = params["province"].lower()
                    # Kiểm tra nếu keyword là substring của province hoặc ngược lại
                    if (keyword_lower in province_lower or 
                        province_lower in keyword_lower or
                        keyword_lower == province_lower):
                        skip_keyword = True
                
                # Skip nếu keyword chứa trong ward name đã map (enhanced matching)
                if params.get("ward"):
                    ward_lower = params["ward"].lower()
                    
                    # Chỉ loại bỏ prefix không phải "phường" và "xã" đầy đủ để so sánh chính xác hơn
                    cleaned_keyword = keyword_lower
                    prefixes = ['thị trấn', 'p.', 'p', 'ward', 'commune']
                    for prefix in prefixes:
                        if cleaned_keyword.startswith(prefix + ' '):
                            cleaned_keyword = cleaned_keyword[len(prefix + ' '):].strip()
                            break
                        elif cleaned_keyword.startswith(prefix):
                            cleaned_keyword = cleaned_keyword[len(prefix):].strip()
                            break
                    
                    # Loại bỏ prefix từ ward name (trừ "phường" và "xã" đầy đủ)
                    cleaned_ward = ward_lower
                    for prefix in prefixes:
                        if cleaned_ward.startswith(prefix + ' '):
                            cleaned_ward = cleaned_ward[len(prefix + ' '):].strip()
                            break
                        elif cleaned_ward.startswith(prefix):
                            cleaned_ward = cleaned_ward[len(prefix):].strip()
                            break
                    
                    # So sánh cả original và cleaned versions
                    if (keyword_lower in ward_lower or 
                        ward_lower in keyword_lower or
                        keyword_lower == ward_lower or
                        cleaned_keyword in cleaned_ward or
                        cleaned_ward in cleaned_keyword or
                        cleaned_keyword == cleaned_ward):
                        skip_keyword = True
                
                # Skip common province variations
                province_variations = [
                    'hồ chí minh', 'thành phố hồ chí minh', 'tp hcm', 'sài gòn',
                    'hà nội', 'thành phố hà nội', 'đà nẵng', 'thành phố đà nẵng'
                ]
                if keyword_lower in province_variations:
                    skip_keyword = True
                
                if not skip_keyword:
                    search_terms.append(keyword)
        if criteria["amenities"] and not amenity_ids:
            search_terms.extend(criteria["amenities"])
        
        if search_terms:
            params["search"] = " ".join(search_terms)
        
        try:
            response = requests.get(self.property_search_url, params=params, timeout=10)
            print(f"params: {params}")
            
            if response.status_code == 200:
                data = response.json()
                properties = data.get("data", {}).get("properties", [])
              
                
                # Properties đã có sẵn các trường province, ward, detailAddress từ API
                # Không cần tạo nested location object - đồng nhất với API search property
                print(f"Final properties (direct fields): {len(properties)} items")
                return properties
            else:
                print(f"API Error: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    
# Khởi tạo MCP service và FastAPI
mcp_service = SmartTroMCP()
app = FastAPI(title="Smart Tro MCP API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],  # Frontend và Backend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_message: ChatMessage):
    """
    API endpoint cho guided conversation
    """
    try:
        result = mcp_service.process_guided_api(
            message=chat_message.message,
            session_id=chat_message.sessionId,
            conversation_state=chat_message.conversationState
        )
        
        return ChatResponse(
            success=result.get('success', True),
            message=result.get('message', ''),
            step=result.get('step', ''),
            options=result.get('options'),
            properties=result.get('properties'),
            totalFound=result.get('totalFound'),
            conversationState=result.get('conversation_state', {}),
            showGrid=result.get('showGrid', False),
            placeholder=result.get('placeholder')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Lấy thông tin session"""
    if session_id in mcp_service.conversation_sessions:
        return {
            "success": True,
            "data": mcp_service.conversation_sessions[session_id]
        }
    return {"success": False, "message": "Session not found"}

def run_fastapi():
    """Chạy FastAPI server"""
    uvicorn.run(app, host="localhost", port=7861, log_level="info")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "gradio":
        print("Starting Gradio interface on http://localhost:7860")
        # Import gradio only when needed
        import gradio as gr
        
        def simple_chat(message):
            result = mcp_service.process_guided_api(message)
            return result.get('message', 'Error processing message')
        
        demo = gr.Interface(
            fn=simple_chat,
            inputs=gr.Textbox(placeholder="Nhập tin nhắn..."),
            outputs=gr.Textbox(),
            title="Smart Tro MCP Chat"
        )
        demo.launch(server_name="localhost", server_port=7860, share=False)
    else:
        print("Starting FastAPI server on http://localhost:7861")
        print("API Documentation: http://localhost:7861/docs")
        print("Health check: http://localhost:7861/api/health")
        
        try:
            run_fastapi()
        except Exception as e:
            print(f"❌ Error starting FastAPI: {e}")
            import traceback
            traceback.print_exc()

