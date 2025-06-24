const styles = {
  container: {
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  card: {
    width: '100%', maxWidth: '900px', backgroundColor: '#fff',
    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    padding: '40px', marginTop: '50px'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  welcomeMessage: { fontSize: '16px', color: '#606770' },
  logoutButton: { border: 'none', background: 'transparent', color: '#1877f2', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  nav: { display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #dddfe2' },
  navButton: { padding: '10px 20px', cursor: 'pointer', border: 'none', borderBottom: '3px solid transparent', background: 'none', fontWeight: 'bold', color: '#606770' },
  activeNavButton: { color: '#1877f2', borderBottom: '3px solid #1877f2' },
  inputContainer: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#1877f2', color: '#fff', cursor: 'pointer' },
  errorText: { color: '#fa383e', marginBottom: '20px', textAlign: 'center' },
  sectionTitle: { fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '15px' },
  wordCloud: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', padding: '10px' },
  wordItem: { cursor: 'default', padding: '5px' },
  historyList: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' },
  historyItem: { padding: '15px', borderBottom: '1px solid #eee' },
  topicTable: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { borderBottom: '2px solid #333', textAlign: 'left', padding: '12px' },
  tableCell: { borderBottom: '1px solid #eee', padding: '12px' },
};

export default styles;