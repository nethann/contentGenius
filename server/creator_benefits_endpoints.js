// Creator Benefits API Endpoints - Add these to server.js

// Create new creator benefit
app.post('/api/creator-benefits', async (req, res) => {
  try {
    const { email, tokens, proDays, proExpiryDate, tier } = req.body;
    
    if (!email || tokens === undefined || proDays === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('🎁 Creating creator benefit:', { email, tokens, proDays });
    
    const result = await DatabaseService.createCreatorBenefit(email, tokens, proDays);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Create creator benefit error:', error);
    res.status(500).json({ error: 'Failed to create creator benefit' });
  }
});

// Get all creator benefits
app.get('/api/creator-benefits', async (req, res) => {
  try {
    console.log('📋 Fetching all creator benefits...');
    
    const result = await DatabaseService.getAllCreatorBenefits();
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, benefits: result.benefits || [] });
  } catch (error) {
    console.error('❌ Get all creator benefits error:', error);
    res.status(500).json({ error: 'Failed to get creator benefits' });
  }
});

// Get creator benefit by email
app.get('/api/creator-benefits/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🔍 Fetching creator benefit for:', email);
    
    const result = await DatabaseService.getCreatorBenefitByEmail(email);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, benefit: result.benefit });
  } catch (error) {
    console.error('❌ Get creator benefit error:', error);
    res.status(500).json({ error: 'Failed to get creator benefit' });
  }
});

// Add tokens to existing creator
app.put('/api/creator-benefits/:email/add-tokens', async (req, res) => {
  try {
    const { email } = req.params;
    const { tokens } = req.body;
    
    if (!tokens || isNaN(tokens) || tokens <= 0) {
      return res.status(400).json({ error: 'Valid token amount is required' });
    }
    
    console.log(`💰 Adding ${tokens} tokens to ${email}`);
    
    const result = await DatabaseService.addTokens(email, tokens);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      message: `Added ${tokens} tokens`, 
      newTotal: result.newTotal 
    });
  } catch (error) {
    console.error('❌ Add tokens error:', error);
    res.status(500).json({ error: 'Failed to add tokens' });
  }
});

// Extend pro access for existing creator
app.put('/api/creator-benefits/:email/extend-pro', async (req, res) => {
  try {
    const { email } = req.params;
    const { days } = req.body;
    
    if (!days || isNaN(days) || days <= 0) {
      return res.status(400).json({ error: 'Valid number of days is required' });
    }
    
    console.log(`👑 Extending pro access for ${email} by ${days} days`);
    
    const result = await DatabaseService.extendProAccess(email, days);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      message: `Pro access extended by ${days} days`, 
      newExpiryDate: result.newExpiryDate 
    });
  } catch (error) {
    console.error('❌ Extend pro access error:', error);
    res.status(500).json({ error: 'Failed to extend pro access' });
  }
});

// Mark benefits as used
app.put('/api/creator-benefits/:email/used', async (req, res) => {
  try {
    const { email } = req.params;
    const { userId } = req.body;
    
    console.log('✅ Marking benefit as used:', { email, userId });
    
    const result = await DatabaseService.markAsUsed(email, userId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Benefits marked as used' });
  } catch (error) {
    console.error('❌ Mark as used error:', error);
    res.status(500).json({ error: 'Failed to mark benefits as used' });
  }
});

// Delete creator benefit
app.delete('/api/creator-benefits/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('🗑️ Deleting creator benefit:', email);
    
    const result = await DatabaseService.deleteCreatorBenefit(email);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Creator benefit deleted' });
  } catch (error) {
    console.error('❌ Delete creator benefit error:', error);
    res.status(500).json({ error: 'Failed to delete creator benefit' });
  }
});