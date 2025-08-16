import axios from "axios";
import https from 'https';

export const getLocationFromCoords = async (req, res) => {
    const { lat, lng } = req.body;

    const apiKey = process.env.LOCATIONIQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ message: "Thiếu LocationIQ API key trong biến môi trường" });
    }

    if (!lat || !lng) {
        return res.status(400).json({ message: "Thiếu lat hoặc lng" });
    }

    try {
        const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lng}&format=json`;
        const response = await axios.get(url);
        console.log("LocationIQ API response:", response.data);

        if (response.data?.display_name) {
            const address = response.data.display_name;
            return res.status(200).json({ address });
        } else {
            return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
        }
    } catch (error) {
        console.error("Lỗi khi gọi LocationIQ:", error.message);
        return res.status(500).json({ message: "Lỗi server khi truy vấn LocationIQ" });
    }
};

// API GIỚI HẠN
export const getNearbyHostels = async (req, res) => {
    const { lat, lng } = req.body

    if (!lat || !lng) {
        return res.status(400).json({ message: 'Thiếu tọa độ' })
    }

    const payload = JSON.stringify({
        languageCode: 'en',
        regionCode: 'VN',
        includedTypes: ['lodging'],
        maxResultCount: 10,
        locationRestriction: {
            circle: {
                center: { latitude: lat, longitude: lng },
                radius: 5000
            }
        },
        rankPreference: 'DISTANCE'
    })

    const options = {
        method: 'POST',
        hostname: 'google-map-places-new-v2.p.rapidapi.com',
        path: '/v1/places:searchNearby',
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': '9e384d6a8cmsh6d21ba1cdfa2d23p185afcjsn97ae856ff9ce',
            'X-RapidAPI-Host': 'google-map-places-new-v2.p.rapidapi.com',
            'X-Goog-FieldMask': '*'
        }
    }

    const request = https.request(options, (response) => {
        const chunks = []

        response.on('data', (chunk) => {
            chunks.push(chunk)
        })

        response.on('end', () => {
            const body = Buffer.concat(chunks).toString()

            try {
                const data = JSON.parse(body)
                const places = data.places || []
              

                const hostels = places.map((place) => ({
                    name: place.displayName?.text || place.primaryTypeDisplayName?.text || 'Unknown',
                    address: place.formattedAddress || place.shortFormattedAddress || 'No address',
                    rating: place.rating || null,
                    mapLink: place.googleMapsUri || '',
                    lat: place.location?.latitude || null,
                    lng: place.location?.longitude || null
                }))
                console.log("Nearby hostels data:", hostels)
                return res.status(200).json({ hostels })
            } catch (error) {
                return res.status(500).json({ message: 'Lỗi khi xử lý dữ liệu', error })
            }
        })
    })

    request.on('error', (err) => {
        return res.status(500).json({ message: 'Lỗi kết nối RapidAPI', error: err.message })
    })

    request.write(payload)
    request.end()
}




    
