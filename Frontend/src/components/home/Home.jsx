import React, { useState } from "react"
import HomePropertiesSection from "./HomePropertiesSection"

const Home = () => {
  const [searchResults, setSearchResults] = useState(null)
  const [searchParams, setSearchParams] = useState(null)

  const handleSearchResults = (results, params) => {
    console.log('Home received search results:', results)
    setSearchResults(results)
    setSearchParams(params)
  }

  // Reset function to be called from Hero
  const handleResetSearch = () => {
    setSearchResults(null)
    setSearchParams(null)
    // Update URL to remove search params
    window.history.pushState({}, '', window.location.pathname)
  }

  return (
    <>
      <HomePropertiesSection 
        searchResults={searchResults}
        searchParams={searchParams}
      />
    </>
  )
}

export default Home
