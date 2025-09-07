import React from 'react';
import PropertiesListing from '../properties/PropertiesListing';
import './HomePropertiesSection.css';

const HomePropertiesSection = ({ searchResults, searchParams }) => {
  return (
    <div className="home-properties-section">
      <div className="properties-wrapper">
        <PropertiesListing 
          isHomePage={true}
          searchResults={searchResults}
          searchParams={searchParams}
        />
      </div>
    </div>
  );
};

export default HomePropertiesSection;
