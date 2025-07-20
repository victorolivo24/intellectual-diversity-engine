const styles = {
  container: {
    backgroundColor: '#1c1e21',
    color: '#f5f6f7',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'Poppins, Arial, sans-serif',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#2a2d30',
    color: '#f5f6f7',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    padding: '20px',
    width: '100%',
    maxWidth: '800px'
  },
  button: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  buttonHover: {
    backgroundColor: '#218838'
  },
  input: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #333',
    backgroundColor: '#222',
    color: '#eaeaea',
  },
  errorText: {
    color: '#fa383e',
    margin: '10px 0'
  },
  nav: {
    display: 'flex',
    marginBottom: '16px',
    gap: '8px'
  },
  navButton: {
    backgroundColor: '#1f1f1f',
    color: '#eaeaea',
    border: '1px solid #333',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '6px'
  },
  activeNavButton: {
    backgroundColor: '#28a745',
    color: 'white',
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
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
    backgroundColor: '#28a745',
    color: '#f1f1f1',
    borderRadius: '12px',
    padding: '5px 10px',
    fontSize: '12px'
  },
  topicTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    backgroundColor: '#28a745',
    color: 'white',
    fontSize: '13px',
    padding: '8px',
    textAlign: 'left'
  },
  tableCell: {
    borderBottom: '1px solid #333',
    padding: '8px',
    fontSize: '12px',
    verticalAlign: 'middle'
  }
};
export default styles;