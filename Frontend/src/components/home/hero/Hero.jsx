import React, { useState, useEffect, useRef } from "react"
import L from "leaflet"


import "leaflet/dist/leaflet.css"
import Heading from "../../common/Heading"
import "./hero.css"

const Hero = () => {
  const [location, setLocation] = useState("")
  const [coords, setCoords] = useState({ lat: null, lng: null })
  const [hostels, setHostels] = useState([])
  const mapRef = useRef(null)
  const mapInstance = useRef(null)


  // Fix lỗi icon không hiện
  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });





  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          setCoords({ lat: latitude, lng: longitude })

          try {
            const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/location`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
            })
            const data = await res.json()
            setLocation(data.address)

            const hostelRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/location/nearby-hostels`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lng: longitude }),
            })
            const hostelData = await hostelRes.json()
           
            await setHostels(hostelData.hostels)
            console.log("Hostels :", hostelData.hostels)
            console.log("Hostels 2:", hostels.map(h => h.name))
     
          } catch (error) {
            console.error("Lỗi khi gọi API:", error)
          }
        },
        (error) => console.error("Lỗi vị trí:", error)
      )
    }
  }, [])

  useEffect(() => {
    if (coords.lat && coords.lng && mapRef.current) {
      // Nếu đã có map cũ thì xóa
      if (mapInstance.current) {
        mapInstance.current.remove()
      }

      // Tạo bản đồ mới
      const map = L.map(mapRef.current).setView([coords.lat, coords.lng], 15)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map)

      // Vị trí hiện tại
      const userIcon = L.icon({
        iconUrl: 'https://png.pngtree.com/png-vector/20230106/ourmid/pngtree-flat-red-location-sign-png-image_6553065.png', // Hoặc chọn icon khác
        iconSize: [30, 30], // kích thước icon
        iconAnchor: [15, 30], // điểm neo của icon (gốc đặt vào vị trí marker)
        popupAnchor: [0, -30] // vị trí hiển thị popup
      });

      L.marker([coords.lat, coords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("Vị trí của bạn")
        .openPopup();


      // Đánh dấu hostel
      // hostels.forEach((hostel) => {
      
      //   if (hostel.lat && hostel.lng) {
      //     L.marker([hostel.lat, hostel.lng])
      //       .addTo(map)
      //       .bindPopup(`<strong>${hostel.name}</strong><br>${hostel.address}<br>⭐ ${hostel.rating || "N/A"}`)
      //   }
      // })

      mapInstance.current = map
    }
  }, [coords, hostels])


  return (
    <section className='hero'>
      <div className='container'>
        <Heading
          title='Search Your Next Home '
          subtitle='Find new & featured property located in your local city.'
        />

        <form className='flex'>
          <div className='box'>
            <span>City/Street</span>
            <input
              type='text'
              placeholder='Location'
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className='box'>
            <span>Property Type</span>
            <input type='text' placeholder='Property Type' />
          </div>
          <div className='box'>
            <span>Price Range</span>
            <input type='text' placeholder='Price Range' />
          </div>
          <div className='box'>
            <h4>Advance Filter</h4>
          </div>
          <button className='btn1'>
            <i className='fa fa-search'></i>
          </button>
        </form>

        {/* Bản đồ Leaflet */}
        <div
          ref={mapRef}
          style={{
            height: "500px",
            width: "100%",
            marginTop: "20px",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        ></div>
      </div>
    </section>
  )
}

export default Hero
