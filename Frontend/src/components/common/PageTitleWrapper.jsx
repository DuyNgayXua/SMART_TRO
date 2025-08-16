import usePageTitle from '../../hooks/usePageTitle';

const PageTitleWrapper = ({ children }) => {
  usePageTitle();
  return children;
};

export default PageTitleWrapper;
