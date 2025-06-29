// styles.js

const styles = {
  container: {
    backgroundColor: '#121212',
    color: '#f1f1f1',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'Poppins, Arial, sans-serif',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#1f1f1f',
    color: '#f1f1f1',
    borderRadius: '16px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
    padding: '20px',
    width: '100%',
    maxWidth: '800px',
    transition: 'all 0.3s ease'
  },
  button: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'background 0.3s ease',
  },
  buttonHover: {
    backgroundColor: '#218838'
  },
  input: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #444',
    backgroundColor: '#222',
    color: '#f1f1f1',
  },
  errorText: {
    color: '#fa383e',
    margin: '10px 0'
  },
  nav: {
    display: 'flex',
    borderBottom: '1px solid #333',
    marginBottom: '16px'
  },
  navButton: {
    backgroundColor: 'transparent',
    color: '#f1f1f1',
    border: 'none',
    padding: '12px 20px',
    cursor: 'pointer',
    transition: 'color 0.3s ease, border-bottom 0.3s ease',
    fontSize: '14px',
    borderBottom: '2px solid transparent'
  },
  activeNavButton: {
    color: '#28a745',
    borderBottom: '2px solid #28a745',
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    borderBottom: '1px solid #333',
    paddingBottom: '5px',
    marginBottom: '10px'
  },
  sentimentBar: {
    margin: '10px 0',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  wordCloud: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px'
  },
  wordItem: {
    backgroundColor: 'green',
    color: '#FAF9F6',
    borderRadius: '15px',
    padding: '5px 10px',
    margin: '5px',
    display: 'inline-block'
  }
  ,
  topicTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    backgroundColor: '#28a745',
    color: 'white',
    fontSize: '13px',
    padding: '8px'
  },
  tableCell: {
    borderBottom: '1px solid #333',
    padding: '8px',
    fontSize: '12px'
  }
};

export default styles;
