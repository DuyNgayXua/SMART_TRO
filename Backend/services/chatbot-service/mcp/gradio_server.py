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
        self.location_api_url = "https://provinces.open-api.vn/api"
        self.amenities_api_url = "http://localhost:5000/api/amenities/all"
        
        # Cache để tránh gọi API nhiều lần
        self.provinces_cache = None
        self.districts_cache = {}
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
            # Load provinces
            response = requests.get(f"{self.location_api_url}/p/")
            if response.status_code == 200:
                self.provinces_cache = response.json()

                print(f"Loaded {len(self.provinces_cache)} provinces")
            
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
    
    def _get_province_id_by_name(self, province_name: str) -> Optional[str]:
        """Tìm province ID từ tên tỉnh"""
        if not self.provinces_cache:
            return None
        
        province_name = province_name.lower().strip()
        for province in self.provinces_cache:
            if province_name in province['name'].lower():
                return str(province['code'])
        return None
    
    def _get_district_id_by_name(self, province_code: str, district_name: str) -> Optional[str]:
        """Tìm district ID từ tên quận/huyện"""
        try:
            # Check cache trước
            cache_key = f"{province_code}"
            if cache_key not in self.districts_cache:
                response = requests.get(f"{self.location_api_url}/p/{province_code}?depth=2")
                if response.status_code == 200:
                    data = response.json()
                    self.districts_cache[cache_key] = data.get('districts', [])
            
            districts = self.districts_cache.get(cache_key, [])
            district_name = district_name.lower().strip()
            
            for district in districts:
                if district_name in district['name'].lower():
                    return str(district['code'])
        except Exception as e:
            print(f"Error getting district ID: {e}")
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
    
    def _extract_location_from_text(self, text: str) -> Dict[str, Optional[str]]:
        """Trích xuất thông tin location từ text"""
        result = {'province_id': None, 'district_id': None}
        
        # Patterns để tìm địa điểm
        location_patterns = [
            r'(?:tỉnh|thành phố|tp)\s*([^\s,]+)',
            r'(?:quận|huyện|q\.?)\s*([^\s,]+)',
            r'(?:phường|xã|p\.?)\s*([^\s,]+)',
        ]
        
        text_lower = text.lower()
        
        # Tìm tỉnh/thành phố
        for pattern in [r'(?:tp|thành phố)\s*(\w+)', r'(?:tỉnh)\s*(\w+)', r'(\w+(?:\s+\w+)?)\s*(?:province|city)']:
            matches = re.findall(pattern, text_lower)
            if matches:
                province_name = matches[0].strip()
                result['province_id'] = self._get_province_id_by_name(province_name)
                break
        
        # Tìm quận/huyện
        if result['province_id']:
            for pattern in [r'(?:quận|q\.?|huyện)\s*(\w+)', r'(\w+)\s*(?:district)']:
                matches = re.findall(pattern, text_lower)
                if matches:
                    district_name = matches[0].strip()
                    result['district_id'] = self._get_district_id_by_name(result['province_id'], district_name)
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
                'message': "Vui lòng cho biết khu vực cụ thể (tỉnh, thành phố) mà bạn muốn tìm?",
                'conversation_state': state,
                'step': 'location_input',
                'placeholder': 'Ví dụ: Quận Gò Vấp, Huyện Hóc Môn, TP HCM'
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

        # Giới hạn số lượng properties trả về
        limited_properties = properties[:8]
        total_found = len(properties)
        displayed_count = len(limited_properties)

        # Tạo response với kết quả
        response = {
            'message': f"Tuyệt vời! Tôi đã tìm thấy {displayed_count} bài đăng phù hợp với yêu cầu của bạn.",
            'properties': limited_properties,
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
        """Extract thông tin location chi tiết và map sang ID"""
        location_info = self._extract_location_from_text(message)
        
        result = {
            'text': message.strip(),
            'province_id': location_info.get('province_id'),
            'district_id': location_info.get('district_id'),
            'keywords': []
        }
        
        # Thêm các keywords không map được ID vào search text
        if not location_info.get('province_id'):
            # Extract location keywords từ message
            location_patterns = [
                r'(?:quận|q\.?|huyện)\s+([^,\.\s]+(?:\s+[^,\.\s]+)*)',
                r'(?:tỉnh|thành phố|tp\.?)\s+([^,\.\s]+(?:\s+[^,\.\s]+)*)',
                r'([a-zA-ZÀ-ỹ\s]+)(?=\s*[,\.]|$)'
            ]
            
            for pattern in location_patterns:
                matches = re.findall(pattern, message, re.IGNORECASE)
                for match in matches:
                    if match.strip():
                        result['keywords'].append(match.strip())
        
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
            "location": {"keywords": [], "province": "", "district": ""},
            "area": {},
            "amenities": [],
            "maxOccupants": "",
            "extractedKeywords": []
        }
        
        # Xử lý location details (có province/district ID)
        if collected_data.get('location_details'):
            location_details = collected_data['location_details']
            if location_details.get('province_id'):
                criteria["location"]["province"] = location_details['province_id']
            if location_details.get('district_id'):
                criteria["location"]["district"] = location_details['district_id']
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
        
        # Use mapped province/district IDs if available
        if criteria["location"].get("province"):
            params["provinceId"] = criteria["location"]["province"]
        if criteria["location"].get("district"):
            params["districtId"] = criteria["location"]["district"]
        
        # Fallback: Map location keywords to provinceId and districtId if not already mapped
        if not params.get("provinceId") and criteria["location"]["keywords"]:
            location_info = self._extract_location_from_text(" ".join(criteria["location"]["keywords"]))
            if location_info['province_id']:
                params["provinceId"] = location_info['province_id']
            if location_info['district_id']:
                params["districtId"] = location_info['district_id']
        
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
        
        # Search text từ location keywords (nếu không map được ID) và other keywords
        search_terms = []
        
        # Get location_info first
        location_info = {'province_id': None, 'district_id': None}
        if criteria["location"]["keywords"]:
            location_info = self._extract_location_from_text(" ".join(criteria["location"]["keywords"]))
        
        if not location_info.get('province_id') and criteria["location"]["keywords"]:
            search_terms.extend(criteria["location"]["keywords"])
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
              
                
                # Process properties để đảm bảo có location object đầy đủ
                if properties:
                    # Xử lý location object cho mỗi property
                    for prop in properties:
                        # Ưu tiên sử dụng location có sẵn từ API trước
                        existing_location = prop.get('location', {})
                        if existing_location and any(existing_location.values()):
                            # Đảm bảo location có đủ các field cần thiết
                            if not existing_location.get('provinceName'):
                                existing_location['provinceName'] = ''
                            if not existing_location.get('districtName'):
                                existing_location['districtName'] = ''
                            if not existing_location.get('wardName'):
                                existing_location['wardName'] = ''
                            if not existing_location.get('detailAddress'):
                                existing_location['detailAddress'] = ''
                            prop['location'] = existing_location
                            continue
                        # Nếu không có location sẵn, tạo mới từ raw data
                        location = {}
                        # Load provinces cache để map (chỉ khi cần)
                        province_map = {}
                        if self.provinces_cache:
                            province_map = {str(p['code']): p['name'] for p in self.provinces_cache}
                        # Map province từ raw data
                        province_value = prop.get('province')
                        if province_value:
                            mapped_province = province_map.get(str(province_value), str(province_value))
                            location['provinceName'] = mapped_province
                        # Map district từ raw data
                        district_value = prop.get('district')
                        if district_value:
                            try:
                                if province_value:
                                    # Load districts nếu chưa có trong cache
                                    cache_key = str(province_value)
                                    if cache_key not in self.districts_cache:
                                        try:
                                            districts_response = requests.get(f"{self.location_api_url}/p/{province_value}?depth=2", timeout=5)
                                            if districts_response.status_code == 200:
                                                districts_data = districts_response.json()
                                                self.districts_cache[cache_key] = districts_data.get('districts', [])
                                        except Exception as e:
                                            print(f"   Error loading districts: {e}")
                                            self.districts_cache[cache_key] = []
                                    # Map district name
                                    districts = self.districts_cache.get(cache_key, [])
                                    if districts:
                                        district_map = {str(d['code']): d['name'] for d in districts}
                                        mapped_district = district_map.get(str(district_value), str(district_value))
                                        location['districtName'] = mapped_district
                                    else:
                                        location['districtName'] = str(district_value)  
                                else:
                                    location['districtName'] = str(district_value)
                            except Exception as e:
                                location['districtName'] = str(district_value)
                                print(f"   Error mapping district: {e}")
                        
                        # Map ward từ raw data
                        ward_value = prop.get('ward')
                        if ward_value:
                            location['wardName'] = str(ward_value)
                        # Map detailAddress từ raw data
                        detail_address = prop.get('detailAddress')
                        if detail_address:
                            location['detailAddress'] = str(detail_address)
                        # Fallback: tìm trong các trường khác có chứa "address"
                        if not detail_address:
                            for key, value in prop.items():
                                if 'address' in key.lower() and value:
                                    location['detailAddress'] = str(value)
                                    break
                        # Gán location object đã tạo vào property
                        prop['location'] = location
                print("Final properties", properties)
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

